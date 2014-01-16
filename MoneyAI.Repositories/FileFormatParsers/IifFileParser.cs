using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;
using System.Globalization;
using System.IO;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json;
using System.Data;

namespace MoneyAI.Repositories.FileFormatParsers
{
    internal class IifFileParser : IFileFormatParser
    {
        private string filePath;
        private Settings settings;
        public void Initialize(string filePath, Settings settings = null)
        {
            this.filePath = filePath;
            this.settings = settings == null ? new Settings() : settings;
        }

        public IEnumerable<IEnumerable<KeyValuePair<string, string>>> GetTransactionProperties()
        {
            using (var parser = new CommonUtils.FileFormatParsers.QuickbooksIifParser())
            {
                using(var iiSet = parser.Parse(this.filePath))
                {
                    var dataColumns = new DataColumn[iiSet.Tables["TRNS"].Columns.Count];
                    iiSet.Tables["TRNS"].Columns.CopyTo(dataColumns, 0);
                    var columns = dataColumns.Select(dc => dc.ColumnName.ToLowerInvariant().Trim()).ToArray();
                    var rows = iiSet.Tables["TRNS"].Rows;
                    for(var rowIndex = 0; rowIndex < rows.Count; rowIndex++)
                    {
                        yield return dataColumns.Select((dc, i) => new KeyValuePair<string, string>(columns[i],
                            CleanValue(rows[rowIndex][dc])));
                    }
                }
            }
        }

        private static string CleanValue(object value)
        {
            var cleanedValue = value.ToString();
            if (cleanedValue.Length > 2 && cleanedValue.StartsWith("\"") && cleanedValue.EndsWith("\""))
                return cleanedValue.Substring(1, cleanedValue.Length - 2);

            return cleanedValue;
        }
    }
}
