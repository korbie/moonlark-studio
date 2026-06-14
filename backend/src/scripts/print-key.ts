import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Prints the storefront publishable API key. Run with:
//   npx medusa exec ./src/scripts/print-key.ts
export default async function printKey({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id", "token", "title", "type"],
    filters: { type: "publishable" },
  })
  for (const k of data) {
    console.log(`PUBLISHABLE_KEY=${k.token}`)
  }
}
