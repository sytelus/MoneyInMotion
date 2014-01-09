using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MoneyAI
{
    public interface IParentChildMatch
    {
        IEnumerable<KeyValuePair<Transaction, Transaction>> GetParents(IEnumerable<Transaction> children, Transactions availableTransactions);
    }
}
