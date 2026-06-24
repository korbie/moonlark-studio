import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import { ApiKey } from "../../.medusa/types/query-entry-points";

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[];
    store_id: string;
  }) => {
    const normalizedInput = transform({ input }, (data) => {
      return {
        selector: { id: data.input.store_id },
        update: {
          supported_currencies: data.input.supported_currencies.map(
            (currency) => {
              return {
                currency_code: currency.currency_code,
                is_default: currency.is_default ?? false,
              };
            }
          ),
        },
      };
    });

    const stores = updateStoresStep(normalizedInput);

    return new WorkflowResponse(stores);
  }
);

/**
 * Moonlark Studio seed data — a small handmade crochet shop.
 *
 * Sets up: USD store, North America region, a single "Moonlark Studio"
 * stock location, Standard Shipping + a free Local Pickup option (for craft
 * fairs / events), product categories, a handful of sample crochet products,
 * and a Made-to-Order example for custom commissions.
 *
 * All product imagery uses placeholder URLs — replace with your own photos
 * (which will be uploaded to Cloudflare R2 via the admin).
 */
export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);

  const countries = ["us", "ca"];

  logger.info("Seeding store data...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [{ name: "Default Sales Channel" }],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [{ currency_code: "usd", is_default: true }],
    },
  });

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  });

  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "North America",
          currency_code: "usd",
          countries,
          payment_providers: ["pp_stripe_stripe", "pp_system_default"],
        },
      ],
    },
  });
  const region = regionResult[0];
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Moonlark Studio",
          address: {
            city: "Your City",
            country_code: "US",
            address_1: "",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_location_id: stockLocation.id,
      },
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  logger.info("Seeding fulfillment data...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [{ name: "Default Shipping Profile", type: "default" }],
        },
      });
    shippingProfile = shippingProfileResult[0];
  }

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Moonlark Studio fulfillment",
    type: "shipping",
    service_zones: [
      {
        name: "North America",
        geo_zones: [
          { country_code: "us", type: "country" },
          { country_code: "ca", type: "country" },
        ],
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Ships in 3-5 business days.",
          code: "standard",
        },
        prices: [
          { currency_code: "usd", amount: 8 },
          { region_id: region.id, amount: 8 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
      {
        // Matches the "local pickup / events" requirement — free, in person.
        name: "Local Pickup",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Local Pickup",
          description: "Pick up in person at a market, event, or by arrangement.",
          code: "pickup",
        },
        prices: [
          { currency_code: "usd", amount: 0 },
          { region_id: region.id, amount: 0 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding publishable API key data...");
  let publishableApiKey: ApiKey | null = null;
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id"],
    filters: { type: "publishable" },
  });

  publishableApiKey = data?.[0];

  if (!publishableApiKey) {
    const {
      result: [publishableApiKeyResult],
    } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          { title: "Storefront", type: "publishable", created_by: "" },
        ],
      },
    });

    publishableApiKey = publishableApiKeyResult as ApiKey;
  }

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding publishable API key data.");

  logger.info("Seeding product data...");

  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        { name: "Amigurumi", is_active: true },
        { name: "Made to Order", is_active: true },
      ],
    },
  });

  const catId = (name: string) =>
    categoryResult.find((cat) => cat.name === name)!.id;

  // Sample images live in the storefront's public/samples/ folder, named by
  // product handle. Drop your own photos there (same filenames) to replace
  // these. They're served by the storefront, so we reference its URL.
  const STOREFRONT_URL =
    process.env.STOREFRONT_URL || "http://localhost:8000"
  const sample = (handle: string) => `${STOREFRONT_URL}/samples/${handle}.png`
  // Real product photos dropped into public/samples (exact filenames).
  const photo = (file: string) => `${STOREFRONT_URL}/samples/${file}`;

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Amigurumi Bear",
          category_ids: [catId("Amigurumi")],
          description:
            "A soft, hand-crocheted bear made with cotton yarn. Each one is made by hand, so no two are exactly alike.",
          handle: "amigurumi-bear",
          weight: 150,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{ url: photo("bear.jpg") }],
          options: [{ title: "Size", values: ["One size"] }],
          variants: [
            {
              title: "One size",
              sku: "AMI-BEAR",
              options: { Size: "One size" },
              prices: [{ amount: 28, currency_code: "usd" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Amigurumi Dinosaur",
          category_ids: [catId("Amigurumi")],
          description:
            "A friendly hand-crocheted dinosaur made with cotton yarn. Each one is made by hand, so no two are exactly alike.",
          handle: "amigurumi-dinosaur",
          weight: 160,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{ url: photo("dino.jpg") }],
          options: [{ title: "Size", values: ["One size"] }],
          variants: [
            {
              title: "One size",
              sku: "AMI-DINO",
              options: { Size: "One size" },
              prices: [{ amount: 30, currency_code: "usd" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Amigurumi Ice Cream",
          category_ids: [catId("Amigurumi")],
          description:
            "A sweet hand-crocheted ice cream cone — a playful amigurumi made with cotton yarn.",
          handle: "amigurumi-ice-cream",
          weight: 120,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{ url: photo("icecream.jpg") }],
          options: [{ title: "Size", values: ["One size"] }],
          variants: [
            {
              title: "One size",
              sku: "AMI-ICECREAM",
              options: { Size: "One size" },
              prices: [{ amount: 24, currency_code: "usd" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
        {
          title: "Custom Made-to-Order Piece",
          category_ids: [catId("Made to Order")],
          description:
            "Commission a custom crochet piece. Choose a deposit tier below to get started — we'll follow up to confirm colors, size, and timeline. Use the order notes at checkout to describe what you have in mind.",
          handle: "custom-made-to-order",
          weight: 300,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{ url: sample("custom-made-to-order") }],
          options: [{ title: "Deposit", values: ["Small", "Medium", "Large"] }],
          variants: [
            {
              title: "Small deposit",
              sku: "CUSTOM-DEP-S",
              options: { Deposit: "Small" },
              prices: [{ amount: 25, currency_code: "usd" }],
            },
            {
              title: "Medium deposit",
              sku: "CUSTOM-DEP-M",
              options: { Deposit: "Medium" },
              prices: [{ amount: 50, currency_code: "usd" }],
            },
            {
              title: "Large deposit",
              sku: "CUSTOM-DEP-L",
              options: { Deposit: "Large" },
              prices: [{ amount: 100, currency_code: "usd" }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });
  logger.info("Finished seeding product data.");

  logger.info("Seeding inventory levels.");

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  const inventoryLevels: CreateInventoryLevelInput[] = [];
  for (const inventoryItem of inventoryItems) {
    inventoryLevels.push({
      location_id: stockLocation.id,
      stocked_quantity: 25,
      inventory_item_id: inventoryItem.id,
    });
  }

  await createInventoryLevelsWorkflow(container).run({
    input: { inventory_levels: inventoryLevels },
  });

  logger.info("Finished seeding inventory levels data.");
}
