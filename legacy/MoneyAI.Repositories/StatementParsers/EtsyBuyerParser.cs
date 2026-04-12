using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;
using System.IO;

namespace MoneyAI.Repositories.StatementParsers
{
    internal class EtsyBuyerParser : GenericStatementParser
    {
        public EtsyBuyerParser(string filePath)
            : base(filePath, new[] { ".json" }, new FileFormatParsers.Settings() { IgnoreColumns = new HashSet<string>() { "description" } })
        {
        }

        protected override void SetCalculatedAttributes(Transaction.ImportedValues importedValues)
        {
            base.SetCalculatedAttributes(importedValues);

            if (importedValues.ProviderAttributes.ContainsKey("grandtotal"))
            {
                importedValues.Amount = this.ParseAmount(importedValues.ProviderAttributes["grandtotal"]) * -1;
                importedValues.LineItemType = LineItemType.None;

                //Parse other values for future use
                importedValues.ProviderAttributes["total_tax_cost"] = (this.ParseAmount(importedValues.ProviderAttributes["total_tax_cost"]) * -1).ToStringInvariant();
                importedValues.ProviderAttributes["total_price"] = (this.ParseAmount(importedValues.ProviderAttributes["total_price"]) * -1).ToStringInvariant();
                importedValues.ProviderAttributes["total_shipping_cost"] = (this.ParseAmount(importedValues.ProviderAttributes["total_shipping_cost"]) * -1).ToStringInvariant();
                importedValues.ProviderAttributes["discount_amt"] = this.ParseAmount(importedValues.ProviderAttributes["discount_amt"]).ToStringInvariant();

                importedValues.InstituteReference = importedValues.ProviderAttributes[@"receipt_id"];
                importedValues.SubAccountName = this.SetImportedValueText(importedValues.SubAccountName, importedValues.ProviderAttributes[@"name"], StatementColumnType.SubAccountName);

                importedValues.TransactionDate = long.Parse(importedValues.ProviderAttributes["creation_tsz"].ToString()).FromUnixTime();
                importedValues.EntityName = "Etsy Order# " + importedValues.ProviderAttributes["order_id"];
            }
            else
            {
                importedValues.Amount = this.ParseAmount(importedValues.ProviderAttributes["price"]) * -1;
                importedValues.LineItemType = LineItemType.ItemSubtotal;

                importedValues.InstituteReference = importedValues.ProviderAttributes[@"transaction_id"];
                importedValues.SubAccountName = this.SetImportedValueText(importedValues.SubAccountName, importedValues.ProviderAttributes[@"buyer_user_id"], StatementColumnType.SubAccountName);

                importedValues.TransactionDate = long.Parse(importedValues.ProviderAttributes["paid_tsz"].ToString()).FromUnixTime();
            }

            importedValues.ParentChildMatchFilter = importedValues.ProviderAttributes[@"receipt_id"];
            importedValues.TransactionReason = importedValues.Amount <= 0 ? TransactionReason.Purchase : TransactionReason.Return;
        }

        protected override TransactionReason? InferTransactionReason(Transaction.ImportedValues importedValues)
        {
            return importedValues.TransactionReason;    //Disable default inference
        }
    }
}
