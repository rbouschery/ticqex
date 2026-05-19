import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import {
  updateCustomerSchema,
  parseBody,
} from "@server/lib/validation/schemas";
import {
  getCustomer,
  updateCustomer,
  deleteCustomer,
} from "@server/services/customers";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  return withAuth(request, async () => {
    const { id } = await params;
    return jsonData(await getCustomer(id));
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(request, async () => {
    const { id } = await params;
    const body = parseBody(updateCustomerSchema, await parseJsonBody(request));
    return jsonData(await updateCustomer(id, body));
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return withAuth(request, async () => {
    const { id } = await params;
    await deleteCustomer(id);
    return jsonData({ deleted: true });
  });
}
