import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Sends a confirmation email (via the Resend notification provider) whenever an
 * order is placed. Fails soft: if email isn't configured, the order still
 * completes and we just log a warning.
 */
export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)
  const orderModuleService = container.resolve(Modules.ORDER)

  try {
    const order = await orderModuleService.retrieveOrder(data.id, {
      relations: ["items", "shipping_address"],
    })

    if (!order?.email) {
      logger.warn(`order.placed: order ${data.id} has no email; skipping confirmation`)
      return
    }

    await notificationModuleService.createNotifications({
      to: order.email,
      channel: "email",
      template: "order-placed",
      data: { order },
    })

    logger.info(`order.placed: confirmation email queued for ${order.email}`)
  } catch (e: any) {
    logger.warn(`order.placed: confirmation email skipped — ${e?.message ?? e}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
