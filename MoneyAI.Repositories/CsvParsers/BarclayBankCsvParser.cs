using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI.Repositories.CsvParsers
{
    internal class ChaseCsvParser : CsvParserBase
    {
        protected override bool ValidateColumns(string[] columns)
        {
            if (columns.Length == 1 && this.HeaderColumns == null)
                return false;
            else
                return base.ValidateColumns(columns);
        }

        protected override CsvColumnType GetColumnType(string columnName)
        {
            if (columnName == "category")
                return CsvColumnType.Ignore;
            else
                return base.GetColumnType(columnName);
        }
    }
}
