using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MoneyAI.Repositories.CustomParsers
{
    internal class BarclayCsvParser: CsvTransactionFileParser
    {
        public BarclayCsvParser(string csvFilePath)
            : base(csvFilePath, new Settings() { HasBannerLines = true })
        {

        }
    }
}
