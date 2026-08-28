/**
 * Discriminator for line-item rows within order-history imports.
 *
 * Ported from the C# `LineItemType` enum. Numeric values must be kept in
 * sync with the legacy JSON wire format.
 *
 * @module
 */

/**
 * The type of line item within an order (e.g. Amazon order history).
 *
 * | Member        | Value | Meaning                        |
 * |---------------|------:|--------------------------------|
 * | `None`        |     0 | Not a line item / unknown      |
 * | `ItemSubtotal`|     1 | Item price subtotal            |
 * | `Tax`         |     2 | Tax amount                     |
 * | `Shipping`    |     3 | Shipping charge                |
 * | `Promotions`  |     4 | Promotional discount           |
 */
export enum LineItemType {
  None = 0,
  ItemSubtotal = 1,
  Tax = 2,
  Shipping = 3,
  Promotions = 4,
}
