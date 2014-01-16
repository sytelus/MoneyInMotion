using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MoneyAI.Repositories.StatementParsers
{
    internal class BarclayParser: GenericStatementParser
    {
        public BarclayParser(string filePath)
            : base(filePath, new[] { ".csv" }, new FileFormatParsers.Settings() { HasBannerLines = true })
        {
        }
    }
}
