using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using BrightIdeasSoftware;
using CommonUtils;

namespace MoneyAI.WinForms
{
    public partial class FormMain
    {
        private class CategoryGroupComparer : IComparer<OLVGroup>
        {
            public static readonly CategoryGroupComparer Comparer = new CategoryGroupComparer();
            public int Compare(OLVGroup x, OLVGroup y)
            {
                EnsureGroupTag(x);
                EnsureGroupTag(y);
                TransactionAggregates xt = (TransactionAggregates)x.Tag, yt = (TransactionAggregates)y.Tag;

                return yt.MaxPositiveNegativeTotalAbsolute.CompareTo(xt.MaxPositiveNegativeTotalAbsolute);
            }
        }

        private static void EnsureGroupTag(OLVGroup listViewGroup)
        {
            if (listViewGroup.Tag == null)
            {
                var groupStats = new TransactionAggregates(listViewGroup.Items.Select(i => (Transaction)i.RowObject));
                listViewGroup.Tag = groupStats;
            }
        }


        private void txnListView_FormatCell(object sender, FormatCellEventArgs e)
        {
            if (e.Column == olvColumnAmount)
            {
                var transaction = (Transaction)e.Model;
                if (transaction.Amount < 0)
                    e.SubItem.ForeColor = Color.Red;
            }
        }

        private void txnListView_AboutToCreateGroups(object sender, CreateGroupsEventArgs e)
        {
            if (e.Parameters.GroupByColumn == olvColumnCategory)
            {
                var grandAggregate = new TransactionAggregates();
                foreach (var group in e.Groups)
                {
                    EnsureGroupTag(group);

                    var groupAggregates = (TransactionAggregates)group.Tag;

                    grandAggregate.Add(groupAggregates);
                    groupAggregates.SaveRunningAggregate(grandAggregate);

                    var totalsText = groupAggregates.GetTotalsByReasonDisplayText();
                    var count = groupAggregates.Count;

                    group.Header = "{0} - {1} {2}".FormatEx((string)group.Key, count, totalsText);
                    group.Footer = groupAggregates.GetRunningAggregateDisplayText();
                    group.Subtitle = " ";
                    //group.Collapsed = true;
                }
            }
        }

        private void ApplyCategoryForRows(IList rows)
        {
            if (rows.Count == 0)
                return;

            var firstTx = (Transaction)((OLVListItem)rows[0]).RowObject;
            var lastCategoryEdit = this.appState.LatestMerged.GetEditsDescending(firstTx)
                .FirstOrDefault(edit => edit.Values.IfNotNull(v => v.CategoryPath.IfNotNull(c => c.GetValueOrDefault())) != null);

            var newScopePathTuple = CategoryDialogForm.GetCategoryEditFromUser(lastCategoryEdit, firstTx
                 , rows.Cast<OLVListItem>().Select(r => ((Transaction)r.RowObject).Id).ToList(), this);

            if (newScopePathTuple == null)
                return;

            var affedtedTx = this.appState.LatestMerged.SetCategory(newScopePathTuple.Item1, newScopePathTuple.Item2);

            if (newScopePathTuple.Item1.Type == TransactionEdit.ScopeType.TransactionId)
                RefreshItems(rows);
            else
                this.txnListView.RefreshObjects(affedtedTx.ToList());
        }

        private void ApplyNoteForRows(IList rows, Transactions transactions)
        {
            if (rows.Count == 0)
                return;

            var currentNote = ((Transaction)((OLVListItem)rows[0]).RowObject).Note;
            var newNote = NoteDialogForm.GetNoteFromUser(currentNote, this);

            if (currentNote == newNote)
                return;

            RefreshItems(rows, tx => transactions.SetNote(tx, newNote).ToVoid());
        }

        private static void RefreshItems(IEnumerable rows, Action<Transaction> transactionAction = null)
        {
            foreach (OLVListItem item in rows)
            {
                if (transactionAction != null)
                {
                    var tx = (Transaction)item.RowObject;
                    transactionAction(tx);
                }
                ((ObjectListView)item.ListView).RefreshItem(item);
            }
        }

        private static void ToggleFlagsRows(IEnumerable rows, Transactions transactions)
        {
            RefreshItems(rows, tx => transactions.SetIsUserFlagged(tx, tx.IsUserFlagged.IfNotNullValue(f => !f, true)).ToVoid());
        }

        private void txnListView_CellClick(object sender, CellClickEventArgs e)
        {
            if (e.Column == olvColumnIsUserFlagged)
                ToggleFlagsRows(e.Item.AsEnumerable(), appState.LatestMerged);
        }


        private class TransactionItemComparer : IComparer<OLVListItem>
        {
            public static readonly TransactionItemComparer Comparer = new TransactionItemComparer();
            public int Compare(OLVListItem x, OLVListItem y)
            {
                return ((Transaction)x.RowObject).Amount.CompareTo(((Transaction)y.RowObject).Amount);
            }
        }

        private void txnListView_BeforeCreatingGroups(object sender, CreateGroupsEventArgs e)
        {
            if (e.Parameters.GroupByColumn == olvColumnCategory)
            {
                e.Parameters.GroupComparer = CategoryGroupComparer.Comparer;
            }

            e.Parameters.ItemComparer = TransactionItemComparer.Comparer;
        }
    }
}
