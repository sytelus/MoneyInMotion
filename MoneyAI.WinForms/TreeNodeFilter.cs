using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MoneyAI.WinForms
{
    internal class TreeNodeFilter
    {
        public enum FilterType
        {
            Year, Month, Category, None
        }

        public FilterType Type { get; set; }
        public object Value { get; set; }
    }
}
