import { NextRequest } from "next/server";
import { jsonData, jsonList } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import {
  createCustomerSchema,
  parseBody,
} from "@server/lib/validation/schemas";
import { listCustomers, createCustomer } from "@server/services/customers";

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    const result = await listCustomers(request.nextUrl.searchParams);
    return jsonList(result.customers, {
      total: result.total,
      page: result.page,
      per_page: result.perPage,
    });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    const body = parseBody(createCustomerSchema, await parseJsonBody(request));
    const customer = await createCustomer(body);
    return jsonData(customer, 201);
  });
}
