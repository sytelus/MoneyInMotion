using CommonUtils;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace MoneyAI.WebApi.Models
{
    public class TransactionModel
    {
        public static string GetSerializedJson(string userId)
        {
            var cachedItem = TransactionCache.GetItem(userId);
            return cachedItem.SerializedJson;
        }

        public static int ApplyEdit(string userId, string serializedEdits)
        {
            var cachedItem = TransactionCache.GetItem(userId);

            var edits = JsonSerializer<TransactionEdit[]>.Deserialize(serializedEdits);
            return cachedItem.ApplyEdits(edits);
        }
    }
}