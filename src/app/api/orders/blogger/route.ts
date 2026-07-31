import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Headers لتجاوز حظر CORS عند الإرسال من Blogger
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      storeId,
      productId,
      clientName,
      clientPhone1,
      clientPhone2,
      state,
      city,
      address,
      quantity = 1,
      shippingCost = 0,
      totalPrice,
      notes,
    } = body;

    // 1. التحقق من البيانات المطلوبة
    if (!clientName || !clientPhone1 || !state || !city) {
      return NextResponse.json(
        { error: "الرجاء إدخال جميع البيانات الأساسية (الاسم، الهاتف، الولاية، البلدية)" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. البحث عن أول متجر ومنتج افتراضي في حال لم يتم إرسال storeId / productId من Blogger
    let targetStoreId = storeId;
    let targetProductId = productId;

    if (!targetStoreId) {
      const defaultStore = await prisma.store.findFirst();
      if (defaultStore) targetStoreId = defaultStore.id;
    }

    if (!targetProductId) {
      const defaultProduct = await prisma.product.findFirst({
        where: targetStoreId ? { storeId: targetStoreId } : undefined,
      });
      if (defaultProduct) {
        targetProductId = defaultProduct.id;
        if (!targetStoreId) targetStoreId = defaultProduct.storeId;
      }
    }

    if (!targetStoreId || !targetProductId) {
      return NextResponse.json(
        { error: "لم يتم العثور على متجر أو منتج في لوحة التحكم لربط الطلب به" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. إنشاء سجل الطلب الجديد في قاعدة البيانات
    const newOrder = await prisma.order.create({
      data: {
        storeId: targetStoreId,
        productId: targetProductId,
        clientName: clientName.trim(),
        clientPhone1: clientPhone1.trim(),
        clientPhone2: clientPhone2 ? clientPhone2.trim() : null,
        state: state.trim(),
        city: city.trim(),
        address: address ? address.trim() : null,
        quantity: Number(quantity) || 1,
        shippingCost: Number(shippingCost) || 0,
        totalPrice: totalPrice ? Number(totalPrice) : null,
        shippingType: "HOME",
        notes: notes ? `[Blogger] ${notes}` : "[طلب من Blogger]",
        status: "PENDING",
      },
    });

    return NextResponse.json(
      { success: true, message: "تم تسجيل الطلب بنجاح", orderId: newOrder.id },
      { status: 201, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("Error saving Blogger order:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حفظ الطلب", details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
