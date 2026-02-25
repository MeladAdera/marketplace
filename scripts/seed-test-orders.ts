// scripts/seed-test-orders.ts
import pool from "../src/db/database";
import { v4 as uuidv4 } from "uuid";

async function seedTestVendorOrders() {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    // 🔹 1. جهز بيانات وهمية (استبدل UUIDs ببيانات حقيقية من الداتابيز عندك)
    const TEST_CUSTOMER_ID = "customer-uuid-here"; 
    const TEST_VENDOR_ORG_ID = "your-vendor-org-uuid-here";
    const TEST_VARIANT_ID = "variant-uuid-here"; // المنتج اللي بدنا نشتريه
    
    // 🔹 2. أنشئ Main Order (الأوردر الرئيسي من الزبون)
    const orderNumber = `TEST-${Date.now()}`;
    const mainOrder = await client.query(
      `INSERT INTO orders (
        id, order_number, customer_user_id, status, 
        total_amount_cents, client_request_id
      ) VALUES ($1, $2, $3, 'paid', $4, $5) RETURNING id`,
      [
        uuidv4(),
        orderNumber,
        TEST_CUSTOMER_ID,
        15000, // $150.00
        `test-request-${uuidv4()}` // Idempotency key
      ]
    );
    const mainOrderId = mainOrder.rows[0].id;

    // 🔹 3. أنشئ Vendor Sub-Order (الجزء الخاص بالفيندر)
    const vendorOrder = await client.query(
      `INSERT INTO vendor_orders (
        id, order_id, vendor_organization_id, status, subtotal_amount_cents
      ) VALUES ($1, $2, $3, 'pending', $4) RETURNING id`,
      [
        uuidv4(),
        mainOrderId,
        TEST_VENDOR_ORG_ID,
        15000 // نفس المبلغ لأن في هذا المثال فيندر واحد فقط
      ]
    );
    const vendorOrderId = vendorOrder.rows[0].id;

    // 🔹 4. أنشئ Order Items (المنتجات داخل الأوردر)
    await client.query(
      `INSERT INTO order_items (
        id, vendor_order_id, variant_id, quantity,
        price_snapshot_cents, sku_snapshot, product_name_snapshot
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        uuidv4(),
        vendorOrderId,
        TEST_VARIANT_ID,
        2, // كمية 2
        7500, // $75.00 per item
        'TEST-SKU-001',
        'Test Product Name'
      ]
    );

    // 🔹 5. (اختياري) سجل حركة مخزون أولية "reserve"
    await client.query(
      `INSERT INTO inventory_movements (
        id, organization_id, variant_id, type, quantity_change, 
        reason, related_vendor_order_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        uuidv4(),
        TEST_VENDOR_ORG_ID,
        TEST_VARIANT_ID,
        'reserve',
        -2, // خصم 2 من المخزون
        'Initial stock reservation for test order',
        vendorOrderId
      ]
    );

    await client.query("COMMIT");
    console.log(`✅ Seed successful! Vendor Order ID: ${vendorOrderId}`);
    console.log(`🔗 Test with: GET /vendor/orders/${vendorOrderId}`);
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

seedTestVendorOrders().then(() => process.exit(0));