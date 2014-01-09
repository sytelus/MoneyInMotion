using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using CommonUtils;

namespace MoneyAI.Repositories
{
    internal class AmazonOrdersCsvParser : CsvParserBase
    {
        protected override CsvColumnType GetColumnType(string columnName)
        {
            switch(columnName)
            {
	            case @"order date": return CsvColumnType.ProviderAttribute;
                case @"order id": return CsvColumnType.ProviderAttribute;
                case @"asin/isbn": return CsvColumnType.ProviderAttribute;
                case @"release date": return CsvColumnType.ProviderAttribute;
                case @"condition": return CsvColumnType.ProviderAttribute;
                case @"seller": return CsvColumnType.ProviderAttribute;
                case @"per unit price": return CsvColumnType.ProviderAttribute;
                case @"quantity": return CsvColumnType.ProviderAttribute;
                case @"payment - last 4 digits": return CsvColumnType.ProviderAttribute;
                case @"purchase order number": return CsvColumnType.ProviderAttribute;
                case @"ordering customer email": return CsvColumnType.ProviderAttribute;
                case @"shipment date": return CsvColumnType.ProviderAttribute;
                case @"shipping address name": return CsvColumnType.ProviderAttribute;
                case @"shipping address street 1": return CsvColumnType.ProviderAttribute;
                case @"shipping address street 2": return CsvColumnType.ProviderAttribute;
                case @"shipping address city": return CsvColumnType.ProviderAttribute;
                case @"shipping address state": return CsvColumnType.ProviderAttribute;
                case @"shipping address zip": return CsvColumnType.ProviderAttribute;
                case @"shipment/order condition": return CsvColumnType.ProviderAttribute;
                case @"carrier name & tracking number": return CsvColumnType.ProviderAttribute;
                case @"item subtotal": return CsvColumnType.ProviderAttribute;
                case @"item subtotal tax": return CsvColumnType.ProviderAttribute;
                case @"buyer name": return CsvColumnType.ProviderAttribute;
                case @"group name": return CsvColumnType.ProviderAttribute;
                case @"subtotal": return CsvColumnType.ProviderAttribute;
                case @"shipping charge": return CsvColumnType.ProviderAttribute;
                case @"tax before promotions": return CsvColumnType.ProviderAttribute;
                case @"total promotions": return CsvColumnType.ProviderAttribute;
                case @"tax charged": return CsvColumnType.ProviderAttribute;
                case @"total charged": return CsvColumnType.ProviderAttribute;
            }

            return base.GetColumnType(columnName);
        }

        protected override void SetCalculatedAttributes(Transaction.ImportedValues importedValues, string[] columns)
        {
            base.SetCalculatedAttributes(importedValues, columns);

            //Override others
            var shipmentDateString = importedValues.ProviderAttributes[@"shipment date"];
            if (!string.IsNullOrWhiteSpace(shipmentDateString))
                importedValues.TransactionDate = this.ParsePostednDate(shipmentDateString);

            importedValues.LineItemType = importedValues.ProviderAttributes.ContainsKey(@"item subtotal") ? LineItemType.ItemSubtotal : LineItemType.None;

            if (importedValues.LineItemType != LineItemType.None)
            {
                importedValues.Amount = this.ParseAmount(importedValues.ProviderAttributes[@"item subtotal"]) * -1;
                    //+ this.ParseAmount(importedValues.ProviderAttributes[@"item subtotal tax"])) ;    //Looks like this field does not add up to main order
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
            
            importedValues.TransactionReason = importedValues.Amount <= 0 ? TransactionReason.Purchase : TransactionReason.OtherCredit;

            importedValues.InstituteReference = this.SetImportedValueText(importedValues.InstituteReference, 
                string.Concat(importedValues.ProviderAttributes[@"order id"], "|",  importedValues.ProviderAttributes[@"carrier name & tracking number"]),
                CsvColumnType.InstituteReference);
            importedValues.SubAccountName = this.SetImportedValueText(importedValues.SubAccountName, importedValues.ProviderAttributes[@"buyer name"], CsvColumnType.SubAccountName);

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

        protected override TransactionReason? InferTransactionReason(Transaction.ImportedValues importedValues, string[] columnValues)
        {
            return importedValues.TransactionReason;
        }

        protected override Transaction.ImportedValues ValidateImportedValues(Transaction.ImportedValues importedValues)
        {
            if (string.Equals(importedValues.ProviderAttributes[@"shipment/order condition"], @"Shipment planned", StringComparison.CurrentCultureIgnoreCase) &&
                importedValues.Amount == 0)
            {
                return null;
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
