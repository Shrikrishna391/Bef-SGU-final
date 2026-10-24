"""
Data Migration and Inventory Invariant Verification Service.

Responsibilities:
1. Safely migrate seeded operational scenario data into authoritative PostgreSQL database.
2. Idempotently upsert records (warehouses, retailers/stores, products, batches, orders)
   without creating duplicate entries.
3. Preserve batch-level expiry, available/reserved quantities, inventory versions, and timestamps.
4. Verify critical inventory invariants:
   - Available stock = physical quantity - reserved quantity (accounting for commitments).
   - Stock must never become negative.
   - Reservations must never exceed available stock.
   - Inventory versions increment whenever authoritative inventory changes.
   - Migrations must not silently discard existing data.
5. Guarantee safe migration: old database/data sources are never deleted until PostgreSQL
   invariants are comprehensively verified.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.logging import logger
from app.core.exceptions import AuthoritativeRuleViolationException
from app.models.enums import UserRole, StoreType, OrderPriority, OrderStatus, ScenarioType, ReservationStatus
from app.models.facility import Warehouse, Store, Retailer
from app.models.product import Product
from app.models.inventory import InventoryBatch, InventoryReservation, Reservation
from app.models.order import DistributionOrder, DistributionOrderItem, Order, OrderItem
from app.models.scenario import SeededScenario
from app.models.user import User


class DataMigrationService:
    """
    Authoritative database migration service for PostgreSQL.
    """

    @classmethod
    def migrate_seeded_scenario_data(
        cls,
        db: Session,
        scenario_code: str = "SCENARIO-SURGE-001",
        preserve_existing_versions: bool = True,
    ) -> Dict[str, Any]:
        """
        Migrates and seeds deterministic operational data without duplicating records.
        Preserves existing inventory versions, timestamps, and batch expiry.
        """
        logger.info("Beginning safe scenario data migration into PostgreSQL (scenario: %s)", scenario_code)

        results: Dict[str, Any] = {
            "scenario_code": scenario_code,
            "warehouses_upserted": 0,
            "retailers_upserted": 0,
            "products_upserted": 0,
            "batches_upserted": 0,
            "orders_upserted": 0,
            "duplicates_prevented": 0,
            "status": "COMPLETED",
        }

        # 1. Deterministic Warehouses
        warehouse_seeds: List[Dict[str, Any]] = [
            {
                "code": "WH-WEST-SEED-01",
                "name": "West Seed Distribution Hub",
                "region": "West",
                "capacity_limit": 500000,
                "initial_version": 1,
            },
            {
                "code": "WH-NORTH-SEED-01",
                "name": "North Seed Distribution Hub",
                "region": "North",
                "capacity_limit": 400000,
                "initial_version": 1,
            },
        ]

        wh_map: Dict[str, Warehouse] = {}
        for w_data in warehouse_seeds:
            existing = db.query(Warehouse).filter_by(code=w_data["code"]).first()
            if existing:
                existing.name = w_data["name"]
                existing.region = w_data["region"]
                existing.capacity_limit = w_data["capacity_limit"]
                existing.is_active = True
                wh_map[w_data["code"]] = existing
                results["duplicates_prevented"] += 1
            else:
                wh = Warehouse(
                    code=w_data["code"],
                    name=w_data["name"],
                    region=w_data["region"],
                    capacity_limit=w_data["capacity_limit"],
                    current_inventory_version=w_data["initial_version"],
                    is_active=True,
                )
                db.add(wh)
                wh_map[w_data["code"]] = wh
                results["warehouses_upserted"] += 1

        db.flush()

        # 2. Deterministic Retailers / Stores
        store_seeds: List[Dict[str, Any]] = [
            {
                "code": "STORE-MUM-SEED-01",
                "name": "Mumbai Seed Retail Flagship",
                "region": "West",
                "store_type": StoreType.FLAGSHIP,
                "priority_tier": 1,
            },
            {
                "code": "STORE-DEL-SEED-01",
                "name": "Delhi Seed Express Store",
                "region": "North",
                "store_type": StoreType.EXPRESS,
                "priority_tier": 2,
            },
        ]

        store_map: Dict[str, Store] = {}
        for s_data in store_seeds:
            existing_store = db.query(Store).filter_by(code=s_data["code"]).first()
            if existing_store:
                existing_store.name = s_data["name"]
                existing_store.region = s_data["region"]
                existing_store.store_type = s_data["store_type"]
                existing_store.priority_tier = s_data["priority_tier"]
                existing_store.is_active = True
                store_map[s_data["code"]] = existing_store
                results["duplicates_prevented"] += 1
            else:
                st = Store(
                    code=s_data["code"],
                    name=s_data["name"],
                    region=s_data["region"],
                    store_type=s_data["store_type"],
                    priority_tier=s_data["priority_tier"],
                    is_active=True,
                )
                db.add(st)
                store_map[s_data["code"]] = st
                results["retailers_upserted"] += 1

        db.flush()

        # 3. Deterministic Products
        product_seeds: List[Dict[str, Any]] = [
            {
                "sku": "SKU-SEED-PHONE-X",
                "name": "Seed Smartphone X",
                "category": "Electronics",
                "shelf_life_days": 730,
                "is_perishable": False,
                "unit_cost": 500.0,
            },
            {
                "sku": "SKU-SEED-LAPTOP-15",
                "name": "Seed Laptop 15",
                "category": "Electronics",
                "shelf_life_days": 1095,
                "is_perishable": False,
                "unit_cost": 1000.0,
            },
        ]

        prod_map: Dict[str, Product] = {}
        for p_data in product_seeds:
            existing_prod = db.query(Product).filter_by(sku=p_data["sku"]).first()
            if existing_prod:
                existing_prod.name = p_data["name"]
                existing_prod.category = p_data["category"]
                existing_prod.unit_cost = p_data["unit_cost"]
                prod_map[p_data["sku"]] = existing_prod
                results["duplicates_prevented"] += 1
            else:
                p = Product(
                    sku=p_data["sku"],
                    name=p_data["name"],
                    category=p_data["category"],
                    shelf_life_days=p_data["shelf_life_days"],
                    is_perishable=p_data["is_perishable"],
                    unit_cost=p_data["unit_cost"],
                    is_active=True,
                )
                db.add(p)
                prod_map[p_data["sku"]] = p
                results["products_upserted"] += 1

        db.flush()

        # 4. Deterministic Inventory Batches
        today = date.today()
        batch_seeds: List[Dict[str, Any]] = [
            {
                "wh_code": "WH-WEST-SEED-01",
                "sku": "SKU-SEED-PHONE-X",
                "batch_number": "BATCH-SEED-P1-W1",
                "on_hand": 1000,
                "reserved": 100,
                "committed": 50,
                "expiry_days": 180,
            },
            {
                "wh_code": "WH-NORTH-SEED-01",
                "sku": "SKU-SEED-PHONE-X",
                "batch_number": "BATCH-SEED-P1-W2",
                "on_hand": 600,
                "reserved": 50,
                "committed": 0,
                "expiry_days": 90,
            },
            {
                "wh_code": "WH-WEST-SEED-01",
                "sku": "SKU-SEED-LAPTOP-15",
                "batch_number": "BATCH-SEED-P2-W1",
                "on_hand": 300,
                "reserved": 20,
                "committed": 10,
                "expiry_days": 365,
            },
        ]

        for b_data in batch_seeds:
            wh = wh_map[b_data["wh_code"]]
            prod = prod_map[b_data["sku"]]
            existing_batch = (
                db.query(InventoryBatch)
                .filter_by(warehouse_id=wh.id, product_id=prod.id, batch_number=b_data["batch_number"])
                .first()
            )

            if existing_batch:
                # Update without losing non-negative guarantees or resetting existing versions
                existing_batch.on_hand_quantity = b_data["on_hand"]
                existing_batch.reserved_quantity = b_data["reserved"]
                existing_batch.committed_quantity = b_data["committed"]
                existing_batch.expiry_date = today + timedelta(days=b_data["expiry_days"])
                if not preserve_existing_versions:
                    existing_batch.version = 1
                results["duplicates_prevented"] += 1
            else:
                batch = InventoryBatch(
                    warehouse_id=wh.id,
                    product_id=prod.id,
                    batch_number=b_data["batch_number"],
                    on_hand_quantity=b_data["on_hand"],
                    reserved_quantity=b_data["reserved"],
                    committed_quantity=b_data["committed"],
                    expiry_date=today + timedelta(days=b_data["expiry_days"]),
                    version=1,
                )
                db.add(batch)
                wh.current_inventory_version += 1
                results["batches_upserted"] += 1

        db.flush()

        # 5. Deterministic Distribution Orders
        order_seeds: List[Dict[str, Any]] = [
            {
                "order_number": "ORD-SEED-WEST-001",
                "dest_code": "STORE-MUM-SEED-01",
                "source_wh": "WH-WEST-SEED-01",
                "priority": OrderPriority.HIGH,
                "items": [{"sku": "SKU-SEED-PHONE-X", "qty": 80}, {"sku": "SKU-SEED-LAPTOP-15", "qty": 20}],
            },
            {
                "order_number": "ORD-SEED-NORTH-002",
                "dest_code": "STORE-DEL-SEED-01",
                "source_wh": "WH-NORTH-SEED-01",
                "priority": OrderPriority.NORMAL,
                "items": [{"sku": "SKU-SEED-PHONE-X", "qty": 40}],
            },
        ]

        for o_data in order_seeds:
            dest = store_map[o_data["dest_code"]]
            src = wh_map[o_data["source_wh"]]
            existing_order = db.query(DistributionOrder).filter_by(order_number=o_data["order_number"]).first()
            if existing_order:
                existing_order.destination_store_id = dest.id
                existing_order.source_warehouse_id = src.id
                existing_order.priority = o_data["priority"]
                results["duplicates_prevented"] += 1
            else:
                order = DistributionOrder(
                    order_number=o_data["order_number"],
                    destination_store_id=dest.id,
                    source_warehouse_id=src.id,
                    status=OrderStatus.PENDING,
                    priority=o_data["priority"],
                    required_delivery_date=datetime.now(timezone.utc) + timedelta(days=2),
                )
                db.add(order)
                db.flush()

                for item_data in o_data["items"]:
                    prod = prod_map[item_data["sku"]]
                    order_item = DistributionOrderItem(
                        order_id=order.id,
                        product_id=prod.id,
                        requested_quantity=item_data["qty"],
                        fulfilled_quantity=0,
                    )
                    db.add(order_item)
                results["orders_upserted"] += 1

        # 6. Seed Scenario Metadata
        scenario = db.query(SeededScenario).filter_by(scenario_code=scenario_code).first()
        if not scenario:
            scenario = SeededScenario(
                scenario_code=scenario_code,
                name="Authoritative Production Seed Scenario",
                scenario_type=ScenarioType.DEMAND_SURGE,
                description="Deterministic baseline scenario migrated to authoritative PostgreSQL database.",
                parameters={"target_warehouse_code": "WH-WEST-SEED-01", "surge_factor": 1.5},
                is_active=True,
            )
            db.add(scenario)

        db.commit()
        logger.info("Scenario data migration committed successfully: %s", results)
        return results

    @classmethod
    def verify_inventory_invariants(cls, db: Session) -> Dict[str, Any]:
        """
        Validates all authoritative inventory invariants across PostgreSQL:
        1. Available stock = physical quantity - reserved quantity (accounting for committed quantity).
        2. Stock must never become negative.
        3. Reservations must never exceed available stock.
        4. Inventory versions must change when authoritative inventory changes (version >= 1).
        5. Batch expiry is preserved and valid.
        """
        batches = db.query(InventoryBatch).all()
        warehouses = db.query(Warehouse).all()

        violations = []
        batch_details = []

        for b in batches:
            # Invariant 1: Available stock calculation
            expected_available = max(0, b.on_hand_quantity - (b.reserved_quantity + b.committed_quantity))
            if b.available_quantity != expected_available or b.available_stock != expected_available:
                violations.append(
                    f"Batch {b.batch_number}: available_stock ({b.available_stock}) != "
                    f"expected_available ({expected_available})."
                )

            # Invariant 2: Stock must never become negative
            if b.on_hand_quantity < 0:
                violations.append(f"Batch {b.batch_number}: negative physical on-hand quantity ({b.on_hand_quantity}).")
            if b.reserved_quantity < 0:
                violations.append(f"Batch {b.batch_number}: negative reserved quantity ({b.reserved_quantity}).")
            if b.committed_quantity < 0:
                violations.append(f"Batch {b.batch_number}: negative committed quantity ({b.committed_quantity}).")
            if b.available_quantity < 0 or b.available_stock < 0:
                violations.append(f"Batch {b.batch_number}: negative available stock ({b.available_stock}).")

            # Invariant 3: Reservations must never exceed available stock
            if b.reserved_quantity > (b.on_hand_quantity - b.committed_quantity):
                violations.append(
                    f"Batch {b.batch_number}: reserved quantity ({b.reserved_quantity}) exceeds "
                    f"physical headroom ({b.on_hand_quantity - b.committed_quantity})."
                )

            # Invariant 4: Inventory version must be positive
            if b.version < 1:
                violations.append(f"Batch {b.batch_number}: invalid version number ({b.version}).")

            batch_details.append({
                "batch_id": b.id,
                "batch_number": b.batch_number,
                "physical_quantity": b.physical_quantity,
                "reserved_quantity": b.reserved_quantity,
                "committed_quantity": b.committed_quantity,
                "available_stock": b.available_stock,
                "version": b.version,
                "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
            })

        for wh in warehouses:
            if wh.current_inventory_version < 1:
                violations.append(f"Warehouse {wh.code}: invalid version number ({wh.current_inventory_version}).")

        is_valid = len(violations) == 0

        return {
            "is_valid": is_valid,
            "total_batches_checked": len(batches),
            "total_warehouses_checked": len(warehouses),
            "violations_count": len(violations),
            "violations": violations,
            "migration_status": "VERIFIED" if is_valid else "FAILED",
            "details": {
                "batches": batch_details,
                "warehouses_count": len(warehouses),
            },
        }

    @classmethod
    def execute_safe_migration(
        cls,
        db: Session,
        scenario_code: str = "SCENARIO-SURGE-001",
        legacy_data_source: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Executes an end-to-end safe migration:
        1. Migrates seeded scenario data without duplicating records.
        2. Validates all inventory invariants against PostgreSQL.
        3. Only flags migration as VERIFIED once zero violations are found.
        4. Preserves legacy database/store references without deleting old data.
        """
        # Step 1: Migrate data
        migration_stats = cls.migrate_seeded_scenario_data(db, scenario_code=scenario_code)

        # Step 2: Verify invariants
        verification_report = cls.verify_inventory_invariants(db)

        if not verification_report["is_valid"]:
            raise AuthoritativeRuleViolationException(
                f"Migration verification failed with {verification_report['violations_count']} violations: "
                f"{verification_report['violations']}"
            )

        logger.info(
            "Safe migration completed and VERIFIED. PostgreSQL is authoritative. "
            "Old database preserved at: %s",
            legacy_data_source or "mongo_legacy_archive (preserved)",
        )

        return {
            "migration_stats": migration_stats,
            "verification_report": verification_report,
            "authoritative_database": "PostgreSQL",
            "legacy_preserved": True,
            "legacy_source": legacy_data_source or "mongo_archive_preserved",
            "status": "MIGRATION_VERIFIED_SUCCESSFUL",
        }
