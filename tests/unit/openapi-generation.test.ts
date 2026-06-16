import { describe, expect, it } from "vitest";
import { OPERATION_CATALOG } from "@ticqex/api-spec";
import {
  buildOpenApiDocument,
  countOpenApiOperations,
} from "../../scripts/openapi/build-document.js";
import {
  REQUEST_BODY_BY_OPERATION,
  listOperationsWithRequestBodies,
} from "../../scripts/openapi/request-schemas.js";

describe("OpenAPI generation", () => {
  it("documents every catalog operation", () => {
    const document = buildOpenApiDocument();
    expect(countOpenApiOperations(document)).toBe(OPERATION_CATALOG.length);
  });

  it("includes bearer auth and shared error envelope", () => {
    const document = buildOpenApiDocument();
    expect(document.components.securitySchemes.bearerAuth).toBeDefined();
    expect(document.components.schemas.ApiError).toBeDefined();
  });

  it("uses a server variable for the deployment hostname", () => {
    const document = buildOpenApiDocument();

    expect(document.servers[0]).toMatchObject({
      url: "https://{instanceHost}/api/v1",
      variables: {
        instanceHost: {
          default: "your-instance.com",
        },
      },
    });
  });

  it("maps mutating operations with JSON bodies to request schemas", () => {
    const jsonBodies = listOperationsWithRequestBodies().filter((name) => {
      const kind = REQUEST_BODY_BY_OPERATION[name]?.kind;
      return kind === "json" || kind === "optional-json";
    });

    const document = buildOpenApiDocument();
    for (const operationName of jsonBodies) {
      expect(
        document.components.schemas[`${operationName}Request`],
        operationName,
      ).toBeDefined();
    }
  });

  it("documents attachment upload as multipart form data", () => {
    const document = buildOpenApiDocument();
    const uploadPath = document.paths["/tickets/{ticket_id}/attachment-uploads"];
    expect(uploadPath?.post?.requestBody).toMatchObject({
      content: {
        "multipart/form-data": {
          schema: { $ref: "#/components/schemas/AttachmentUploadRequest" },
        },
      },
    });
  });

  it("documents attachment download query params used by the REST route", () => {
    const document = buildOpenApiDocument();
    const attachmentPath =
      document.paths["/messages/{message_id}/attachments/{attachment_id}"];
    const parameters = attachmentPath?.get?.parameters ?? [];
    const queryNames = parameters
      .filter((param) => param.in === "query")
      .map((param) => param.name);

    expect(queryNames).toEqual(["download", "format"]);
    expect(parameters.find((param) => param.name === "download")?.description).toBeTruthy();
    expect(parameters.find((param) => param.name === "format")?.schema).toMatchObject({
      enum: ["json"],
    });
  });

  it("documents attachment redirect and JSON response modes", () => {
    const document = buildOpenApiDocument();
    const responses =
      document.paths["/messages/{message_id}/attachments/{attachment_id}"]?.get
        ?.responses ?? {};

    expect(responses["302"]).toMatchObject({
      headers: {
        Location: expect.any(Object),
      },
    });
    expect(responses["200"]).toMatchObject({
      content: {
        "application/json": {
          schema: {
            properties: {
              data: { $ref: "#/components/schemas/AttachmentUrlData" },
            },
          },
        },
      },
    });
  });

  it("documents custom field group filter on list endpoint", () => {
    const document = buildOpenApiDocument();
    const parameters = document.paths["/custom-fields"]?.get?.parameters ?? [];
    const groupParam = parameters.find((param) => param.name === "group");

    expect(groupParam).toMatchObject({
      in: "query",
      schema: { enum: ["ticket", "contact"] },
    });
    expect(groupParam?.description).toContain("ticket");
  });

  it("adds readable tag metadata for API reference grouping", () => {
    const document = buildOpenApiDocument();
    const ticketsTag = document.tags.find((tag) => tag.name === "tickets");

    expect(ticketsTag).toMatchObject({
      name: "tickets",
      description: expect.stringContaining("Tickets"),
      "x-displayName": "Tickets",
    });
  });
});
