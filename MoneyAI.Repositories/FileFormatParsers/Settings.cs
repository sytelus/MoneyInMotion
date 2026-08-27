using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MoneyAI.Repositories.FileFormatParsers
{
    public class Settings
    {
        public bool HasBannerLines { get; set; }
        public HashSet<string> IgnoreColumns { get; set; }
    }
}
