using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using CommonUtils;
using System.IO;

namespace MoneyAI.Repositories.StatementParsers
{
    internal class AmazonOrdersParser : GenericStatementParser
    {
        public AmazonOrdersParser(string filePath)
            : base(filePath, new[] { ".csv" })
        {
        }

        protected override void SetCalculatedAttributes(Transaction.ImportedValues importedValues)
        {
            base.SetCalculatedAttributes(importedValues);

            //Override others
            var shipmentDateString = importedValues.ProviderAttributes[@"shipment date"];
            if (!string.IsNullOrWhiteSpace(shipmentDateString))
                importedValues.TransactionDate = this.ParsePostednDate(shipmentDateString);

            importedValues.LineItemType = importedValues.ProviderAttributes.ContainsKey(@"item subtotal") ? LineItemType.ItemSubtotal : LineItemType.None;

            importedValues.ParentChildMatchFilter = string.Concat(importedValues.ProviderAttributes[@"order id"], "|", importedValues.ProviderAttributes[@"carrier name & tracking number"]);
            importedValues.InstituteReference = this.SetImportedValueText(importedValues.InstituteReference, importedValues.ParentChildMatchFilter, StatementColumnType.InstituteReference);
            importedValues.SubAccountName = this.SetImportedValueText(importedValues.SubAccountName, importedValues.ProviderAttributes[@"buyer name"], StatementColumnType.SubAccountName);

            if (importedValues.LineItemType != LineItemType.None)   //if this is individual item
            {
                importedValues.Amount = this.ParseAmount(importedValues.ProviderAttributes[@"item subtotal"]) * -1;
                    //+ this.ParseAmount(importedValues.ProviderAttributes[@"item subtotal tax"])) ;    //Looks like this field does not add up to main order

                importedValues.EntityId = importedValues.ProviderAttributes[@"asin/isbn"];
            }
            else
            {
                importedValues.Amount = this.ParseAmount(importedValues.ProviderAttributes[@"total charged"]) * -1;

                //parse value for future use
                importedValues.ProviderAttributes[@"total promotions"] =
                    this.ParseAmount(importedValues.ProviderAttributes[@"total promotions"]).ToStringInvariant();
                importedValues.ProviderAttributes[@"shipping charge"] = (-1M *  //shipping should be -ve amount
                    this.ParseAmount(importedValues.ProviderAttributes[@"shipping charge"])).ToStringInvariant();
                importedValues.ProviderAttributes[@"tax charged"] = (-1M *  //shipping should be -ve amount
                    this.ParseAmount(importedValues.ProviderAttributes[@"tax charged"])).ToStringInvariant();
            }

            importedValues.TransactionReason = importedValues.Amount <= 0 ? TransactionReason.Purchase : TransactionReason.Return;

            if (string.IsNullOrWhiteSpace(importedValues.EntityName))
            {
                if (importedValues.LineItemType != LineItemType.None)
                    importedValues.EntityName = "Amazon ASIN# {0} Sold By {3}, Order# {1}, Shipment# {2}"
                        .FormatEx(importedValues.ProviderAttributes.GetValueOrDefault(@"asin/isbn")
                        , importedValues.ProviderAttributes[@"order id"]
                        , importedValues.ProviderAttributes[@"carrier name & tracking number"]
                        , importedValues.ProviderAttributes.GetValueOrDefault(@"seller"));
                else
                    importedValues.EntityName = "Amazon Order# {0}, Shipment# {1}"
                        .FormatEx(importedValues.ProviderAttributes[@"order id"]
                        , importedValues.ProviderAttributes[@"carrier name & tracking number"]);

                importedValues.EntityNameNormalized = importedValues.EntityName;
            }
        }

        protected override TransactionReason? InferTransactionReason(Transaction.ImportedValues importedValues)
        {
            return importedValues.TransactionReason;    //Disable default inference
        }

        protected override bool ValidateImportedValues(Transaction.ImportedValues importedValues)
        {
            //TODO: handle pre-orders?
            if (string.Equals(importedValues.ProviderAttributes[@"shipment/order condition"], @"Shipment planned", StringComparison.CurrentCultureIgnoreCase))
            {
                return false;
            }

            return base.ValidateImportedValues(importedValues);
        }

        protected override decimal ParseAmount(string columnValue)
        {
            if (columnValue == "�") //0xFFFD
                return 0;
            else 
                return base.ParseAmount(columnValue);
        }
    }
}
