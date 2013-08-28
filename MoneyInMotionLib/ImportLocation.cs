using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MoneyInMotion
{
    public class ImportInfo
    {
        public string PortableAddress { get; set; }
        public DateTime UpdateDate { get; set; }
        public DateTime CreateDate { get; set; }
        public string ContentHash { get; set; }
    }
}
