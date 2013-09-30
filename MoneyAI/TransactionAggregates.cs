using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI
{
    public class TransactionAggregates
    {
        private readonly IDictionary<TransactionReason, decimal> totalsByReason = new Dictionary<TransactionReason, decimal>();
        public int Count { get; private set; }
        public decimal PositiveTotal { get; private set; }
        public decimal NegativeTotal { get; private set; }
        public decimal Total { get { return this.PositiveTotal + this.NegativeTotal; } }

        public decimal PositiveTotalAbsolute { get { return Math.Abs(this.PositiveTotal); } }
        public decimal NegativeTotalAbsolute { get { return Math.Abs(this.NegativeTotal); } }
        public decimal MaxPositiveNegativeTotalAbsolute { get { return Math.Max(this.PositiveTotalAbsolute, this.NegativeTotalAbsolute); } }

        public TransactionAggregates(IEnumerable<Transaction> trasactions = null)
        {
            if (trasactions != null)
                this.AddRange(trasactions);
        }

        public string GetTotalsByReasonDisplayText()
        {
            return this.totalsByReason
                .Where(tr => tr.Value != 0)
                .OrderBy(tr => Math.Abs(tr.Value))
                .ToDelimitedString("    ", tr => string.Concat(tr.Key.ToString(), " ", Math.Abs(tr.Value).ToString("C")), true);
        }

        public void AddRange(IEnumerable<Transaction> trasactions)
        {
            foreach (var trasaction in trasactions)
                this.Add(trasaction);
        }

        public void Add(Transaction trasaction)
        {
            var current = this.totalsByReason.GetValueOrDefault(trasaction.TransactionReason);
            this.totalsByReason[trasaction.TransactionReason] = current + trasaction.Amount;

            if (trasaction.Amount >= 0)
                this.PositiveTotal += trasaction.Amount;
            else
                this.NegativeTotal += trasaction.Amount;

            this.Count++;
        }
    }
}
