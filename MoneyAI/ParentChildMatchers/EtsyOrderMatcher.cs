using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI.ParentChildMatchers
{
    public class EtsyOrderMatcher : GenericOrderMatcher
    {
        public EtsyOrderMatcher(AccountInfo accountInfo)
            : base(accountInfo, @"total_shipping_cost", @"total_tax_cost", @"discount_amt")
        {
        }
    }
}
