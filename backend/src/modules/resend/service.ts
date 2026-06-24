import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import { Logger, ProviderSendNotificationDTO } from "@medusajs/framework/types"
import { Resend } from "resend"

type InjectedDependencies = { logger: Logger }

type Options = {
  api_key: string
  from: string
}

/**
 * Notification provider that sends email via Resend (https://resend.com).
 * Templates are rendered as plain HTML strings here (no extra render deps).
 * Add new `case`s to `buildEmail` as you add transactional emails.
 */
class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "notification-resend"

  protected logger_: Logger
  protected options_: Options
  protected resend: Resend

  constructor({ logger }: InjectedDependencies, options: Options) {
    super()
    this.logger_ = logger
    this.options_ = options
    this.resend = new Resend(options.api_key)
  }

  static validateOptions(options: Record<string, unknown>) {
    if (!options.api_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Resend notification provider requires an `api_key` option."
      )
    }
    if (!options.from) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Resend notification provider requires a `from` option."
      )
    }
  }

  async send(notification: ProviderSendNotificationDTO) {
    const { subject, html } = this.buildEmail(notification)

    const { data, error } = await this.resend.emails.send({
      from: this.options_.from,
      to: [notification.to],
      subject,
      html,
    })

    if (error) {
      this.logger_.error(`Resend failed to send "${notification.template}": ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }

    return { id: data?.id }
  }

  private buildEmail(notification: ProviderSendNotificationDTO): {
    subject: string
    html: string
  } {
    const data = (notification.data ?? {}) as Record<string, any>

    switch (notification.template) {
      case "order-placed":
        return this.orderPlacedEmail(data.order)
      default:
        // Generic fallback: callers can pass {subject, html} in data.
        return {
          subject: data.subject ?? "Moonlark Studio",
          html: data.html ?? "",
        }
    }
  }

  private money(amount: unknown, currency = "usd"): string {
    const n = typeof amount === "number" ? amount : Number(amount ?? 0)
    const symbol = currency?.toLowerCase() === "usd" ? "$" : ""
    return `${symbol}${n.toFixed(2)}`
  }

  private orderPlacedEmail(order: any): { subject: string; html: string } {
    const orderNo = order?.display_id ?? order?.id ?? ""
    const currency = order?.currency_code ?? "usd"
    const items: any[] = Array.isArray(order?.items) ? order.items : []

    const itemsSum = items.reduce(
      (sum, i) => sum + Number(i?.unit_price ?? 0) * Number(i?.quantity ?? 0),
      0
    )
    const total = order?.total ?? itemsSum

    const rows = items
      .map(
        (i) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">${i?.product_title ?? i?.title ?? "Item"}${
            i?.variant_title ? ` <span style="color:#888;">(${i.variant_title})</span>` : ""
          }</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;">${i?.quantity ?? 1}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${this.money(i?.unit_price, currency)}</td>
        </tr>`
      )
      .join("")

    const addr = order?.shipping_address
    const shipBlock = addr
      ? `<p style="margin:16px 0 4px;color:#555;"><strong>Shipping to</strong><br/>
          ${[addr.first_name, addr.last_name].filter(Boolean).join(" ")}<br/>
          ${[addr.address_1, addr.address_2].filter(Boolean).join(", ")}<br/>
          ${[addr.city, addr.province, addr.postal_code].filter(Boolean).join(", ")}<br/>
          ${addr.country_code ? String(addr.country_code).toUpperCase() : ""}</p>`
      : ""

    const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#222;">
      <h1 style="font-size:22px;margin:0 0 4px;">Thank you for your order!</h1>
      <p style="color:#555;margin:0 0 16px;">Moonlark Studio — handmade crochet</p>
      <p>Hi${order?.shipping_address?.first_name ? ` ${order.shipping_address.first_name}` : ""}, we've received your order${
        orderNo ? ` <strong>#${orderNo}</strong>` : ""
      } and we're getting it ready. Because each piece is made by hand, we'll be in touch if anything affects timing.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead>
          <tr style="text-align:left;color:#888;font-size:12px;text-transform:uppercase;">
            <th style="padding:0 0 6px;">Item</th>
            <th style="padding:0 0 6px;text-align:center;">Qty</th>
            <th style="padding:0 0 6px;text-align:right;">Price</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="text-align:right;font-size:16px;margin:0 0 8px;"><strong>Total: ${this.money(total, currency)}</strong></p>
      ${shipBlock}
      <p style="margin-top:24px;color:#555;">Questions? Just reply to this email.</p>
      <p style="color:#999;font-size:12px;">Moonlark Studio · moonlarkstudio.com</p>
    </div>`

    return { subject: `Your Moonlark Studio order${orderNo ? ` #${orderNo}` : ""}`, html }
  }
}

export default ResendNotificationProviderService
