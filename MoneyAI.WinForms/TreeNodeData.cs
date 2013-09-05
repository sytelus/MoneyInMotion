using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MoneyAI.WinForms
{
    internal class TreeNodeData
    {
        public int? YearFilter { get; set; }
        public int? MonthFilter { get; set; }
        public string[] CategoryPathFilter { get; set; }
        public string Text { get; set; }
    }
}
