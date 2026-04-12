using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;
using System.Globalization;
using System.IO;

namespace MoneyAI.Repositories.FileFormatParsers
{
    internal class CsvFileParser : IFileFormatParser
    {
        private string csvFilePath;
        private Settings settings;
        private string[] headerColumns;
        public void Initialize(string filePath, Settings settings = null)
        {
            this.csvFilePath = filePath;
            this.settings = settings == null ? new Settings() : settings;
        }

        public IEnumerable<IEnumerable<KeyValuePair<string, string>>> GetTransactionProperties()
        {
            foreach(var line in File.ReadLines(csvFilePath))
            {
                if (!string.IsNullOrWhiteSpace(line))
                {
                    var columns = Utils.ParseCsvLine(line).ToArray();

                    if (this.settings.HasBannerLines && columns.Length < 3 && this.headerColumns == null)
                        continue;

                    if (columns.Length > 1 && columns[columns.Length - 1] == "" && this.headerColumns != null && this.headerColumns.Length < columns.Length)    //Remove training blanks
                        columns = columns.Slice(0, columns.Length - 2).ToArray();

                    if (this.headerColumns == null)
                    {
                        string[] headerColumnsTransformed, dataColumns;
                        this.TransformHeaderColumnNames(columns, out headerColumnsTransformed, out dataColumns);
                        this.headerColumns = headerColumnsTransformed;

                        if (dataColumns == null)
                            continue;
                    }

                    var columnKvp = new Dictionary<string, string>();
                    yield return this.headerColumns.Zip(columns, (header, column) => new KeyValuePair<string, string>(header, column))
                        .Where(kvp => !string.IsNullOrWhiteSpace(kvp.Key));
                }
            }
        }

        protected virtual void TransformHeaderColumnNames(string[] columns, out string[] headerColumnsTransformed, out string[] dataColumns)
        {
            headerColumnsTransformed = columns.Select(c => c.ToLowerInvariant().Trim())
                .Select(c => this.settings.IgnoreColumns != null && this.settings.IgnoreColumns.Contains(c) ? string.Concat("_", c) : c )   //For ignored columns attach "_" so they get in as ProviderAttribute
                .ToArray();
            
            dataColumns = null;
        }
    }
}
