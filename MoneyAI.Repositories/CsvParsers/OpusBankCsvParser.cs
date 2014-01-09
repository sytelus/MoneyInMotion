using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI.Repositories.CsvParsers
{
    internal class OpusBankCsvParser : CsvParserBase
    {
        protected override HeaderColumn[] GetHeaderColumns(string[] columns, out string[] transformedColumns)
        {
            if (columns[columns.Length - 1] == "")
                columns = columns.Slice(0, columns.Length - 2).ToArray();
            return base.GetHeaderColumns(columns, out transformedColumns);
        }

        protected override CsvColumnType GetColumnType(string columnName)
        {
            if (columnName == "trandatetime")
                return CsvColumnType.Ignore;
            else
                return base.GetColumnType(columnName);
        }
    }
}
