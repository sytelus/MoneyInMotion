using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Runtime.Serialization;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI
{
    [DataContract]  //This is only added for quick and dirty clonning
    public class TransactionAggregates
    {
        [DataMember]
        private readonly IDictionary<TransactionReason, decimal> totalsByReason = new Dictionary<TransactionReason, decimal>();

        [DataMember(Name = "count")]
        public int Count { get; private set; }

        [DataMember(Name = "positiveTotal")]
        public decimal PositiveTotal { get; private set; }

        [DataMember(Name = "negativeTotal")]
        public decimal NegativeTotal { get; private set; }
        
        public decimal Total { get { return this.PositiveTotal + this.NegativeTotal; } }
        public decimal PositiveTotalAbsolute { get { return Math.Abs(this.PositiveTotal); } }
        public decimal NegativeTotalAbsolute { get { return Math.Abs(this.NegativeTotal); } }
        public decimal MaxPositiveNegativeTotalAbsolute { get { return Math.Max(this.PositiveTotalAbsolute, this.NegativeTotalAbsolute); } }

        //Running aggregate is not serialized because serializaton is used to just capture the state of main aggregate and save it
        public TransactionAggregates RunningAggregate { get; private set; }

        public TransactionAggregates(IEnumerable<Transaction> trasactions = null)
        {
            if (trasactions != null)
                this.AddRange(trasactions);
        }

        public void SaveRunningAggregate(TransactionAggregates runningAggregate)
        {
            if (this.RunningAggregate != null)
                throw new Exception("Running aggregate is already set");

            var cloned = runningAggregate.Clone();
            this.RunningAggregate = cloned;
        }

        private TransactionAggregates Clone()
        {
            var serialized = JsonSerializer<TransactionAggregates>.Serialize(this);
            return JsonSerializer<TransactionAggregates>.Deserialize(serialized);
        }

        public IEnumerable<KeyValuePair<TransactionReason, decimal>> TotalsByReason
        {
            get { return this.totalsByReason; }
        }

        public void Add(TransactionAggregates otherAggregate)
        {
            foreach (var runningTotalByReason in otherAggregate.TotalsByReason)
                this.AddToTotalByReason(runningTotalByReason.Key, runningTotalByReason.Value);

            this.PositiveTotal += otherAggregate.PositiveTotal;
            this.NegativeTotal += otherAggregate.NegativeTotal;

            this.Count += otherAggregate.Count;
        }

        private void AddToTotalByReason(TransactionReason transactionReason, decimal amount)
        {
            var current = this.totalsByReason.GetValueOrDefault(transactionReason);
            this.totalsByReason[transactionReason] = current + amount;
        }

        public string GetRunningAggregateDisplayText()
        {
            return this.RunningAggregate.IfNotNull(ra => ra.GetTotalsByReasonDisplayText());
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
            this.AddToTotalByReason(trasaction.TransactionReason, trasaction.Amount);

            if (trasaction.Amount >= 0)
                this.PositiveTotal += trasaction.Amount;
            else
                this.NegativeTotal += trasaction.Amount;

            this.Count++;
        }
    }
}
