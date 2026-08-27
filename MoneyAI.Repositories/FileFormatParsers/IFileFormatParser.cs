using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MoneyAI.Repositories.FileFormatParsers
{
    internal interface IFileFormatParser
    {
        void Initialize(string csvFilePath, Settings settings = null);
        IEnumerable<IEnumerable<KeyValuePair<string, string>>> GetTransactionProperties();
    }
}
