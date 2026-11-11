const stringList = { type: "array", items: { type: "string" }, uniqueItems: true };
export const corsSchema = {
  type: "array",
  description: "CORS rules for this R2 bucket. An empty array removes all rules.",
  maxItems: 100,
  items: {
    type: "object",
    required: ["allowed"],
    additionalProperties: false,
    properties: {
      id: { type: "string", description: "Optional identifier for this rule." },
      allowed: {
        type: "object",
        required: ["origins", "methods"],
        additionalProperties: false,
        description: "Origins, methods, and request headers allowed by this rule.",
        properties: {
          origins: {
            ...stringList,
            minItems: 1,
            description: "Allowed origins, such as https://example.com. Use * to allow any origin.",
          },
          methods: {
            type: "array",
            minItems: 1,
            uniqueItems: true,
            items: { enum: ["GET", "HEAD", "PUT", "POST", "DELETE"] },
            description: "Allowed HTTP methods. Preflight OPTIONS requests are handled by R2.",
          },
          headers: {
            ...stringList,
            description: "Allowed request headers. Use * to allow any request header.",
          },
        },
      },
      exposeHeaders: {
        ...stringList,
        description: "Response headers browser JavaScript may read, such as ETag.",
      },
      maxAgeSeconds: {
        type: "integer",
        minimum: 0,
        maximum: 86400,
        description: "How long browsers can cache preflight responses, in seconds (up to 86400).",
      },
    },
  },
};
