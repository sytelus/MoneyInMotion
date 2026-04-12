using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI.ParentChildMatchers
{
    public class AmazonOrderMatcher : GenericOrderMatcher
    {
        public AmazonOrderMatcher(AccountInfo accountInfo)
            :base(accountInfo, @"shipping charge", @"tax charged", @"total promotions")
        {
        }
    }
}
