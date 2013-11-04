using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using CommonUtils;

namespace MoneyAI.WinForms
{
    public partial class FormMain
    {
        private static string GetMonthDisplayName(int month)
        {
            return CultureInfo.CurrentCulture.DateTimeFormat.GetAbbreviatedMonthName(month);
        }

        private static void RefreshNode(TreeNode treeNode, Transactions allTransactions, IEnumerable<Transaction> parentTransactions = null)
        {
            var isExpanded = treeNode.IsExpanded;
            var treeNodeData = (TreeNodeData)treeNode.Tag;
            if (treeNodeData.YearFilter == null)
            {
                var yearGroups = allTransactions.GroupBy(t => t.CorrectedTransactionDate.Year).OrderByDescending(g => g.Key);
                foreach (var yearGroup in yearGroups)
                {
                    var yearTreeNode = CategoryNode.CreateTreeNode(treeNode,
                        new TreeNodeData() { Text = yearGroup.Key.ToStringCurrentCulture(), YearFilter = yearGroup.Key });
                    RefreshNode(yearTreeNode, allTransactions, yearGroup.Select(t => t));

                    yearTreeNode.Expand();
                }
            }
            else if (treeNodeData.MonthFilter == null)
            {
                var year = treeNodeData.YearFilter.Value;
                parentTransactions = parentTransactions ?? allTransactions.Where(t => t.CorrectedTransactionDate.Year == year);
                var monthGroups = parentTransactions.GroupBy(t => t.CorrectedTransactionDate.Month).OrderByDescending(g => g.Key);
                foreach (var monthGroup in monthGroups)
                {
                    var monthTreeNode = CategoryNode.CreateTreeNode(treeNode, new TreeNodeData()
                    {
                        Text = GetMonthDisplayName(monthGroup.Key),
                        YearFilter = year,
                        MonthFilter = monthGroup.Key
                    });
                    RefreshNode(monthTreeNode, allTransactions, monthGroup.Select(t => t));
                }
            }
            else
            {
                var year = treeNodeData.YearFilter.Value;
                var month = treeNodeData.MonthFilter.Value;

                parentTransactions = parentTransactions ?? allTransactions.Where(t => t.CorrectedTransactionDate.Year == year).Where(t => t.CorrectedTransactionDate.Month == month);

                var categoryPathsAndSum = parentTransactions
                    .GroupBy(t => t.DisplayCategoryPathOrNameCocatenated)
                    .Select(tg => Tuple.Create(tg.First().DisplayCategoryPathOrName, tg.Sum(t => t.Amount), tg.Count()))
                    .OrderByDescending(tp => tp.Item2);

                var rootCategoryNode = new CategoryNode(null);

                foreach (var categoryPathAndSum in categoryPathsAndSum)
                    rootCategoryNode.Merge(categoryPathAndSum.Item1, categoryPathAndSum.Item2, categoryPathAndSum.Item3);

                rootCategoryNode.BuildTreeViewNodes(treeNode, year, month);
            }

            if (isExpanded)
                treeNode.Expand();
        }

        private void RefreshExplorer(Transactions transactions)
        {
            txnTreeView.Nodes.Clear();

            var rootTreeNode = CategoryNode.CreateTreeNode(null, new TreeNodeData() { Text = "All" });
            txnTreeView.Nodes.Add(rootTreeNode);

            RefreshNode(rootTreeNode, transactions);

            rootTreeNode.Expand();

            if (txnTreeView.SelectedNode == null)
            {
                txnTreeView.SelectedNode = rootTreeNode.Nodes.Cast<TreeNode>().FirstOrDefault()
                        .IfNotNull(yearNode => yearNode.Nodes.Cast<TreeNode>().FirstOrDefault());
            }
        }

        private void txnTreeView_AfterSelect(object sender, TreeViewEventArgs e)
        {
            if (txnTreeView.SelectedNode != null)
            {
                var filter = (TreeNodeData)txnTreeView.SelectedNode.Tag;
                var filteredTransactions = appState.LatestMerged.Where(t =>
                    (filter.YearFilter == null || t.CorrectedTransactionDate.Year == filter.YearFilter.Value)
                    && (filter.MonthFilter == null || t.CorrectedTransactionDate.Month == filter.MonthFilter.Value)
                    && (filter.CategoryPathFilter == null || IsCategoryPathMatch(filter.CategoryPathFilter, t.DisplayCategoryPathOrName)));

                txnListView.SetObjects(filteredTransactions);
            }
            else txnListView.ClearObjects();
            txnListView.Sort(olvColumnCategory);
        }

        private static bool IsCategoryPathMatch(ICollection<string> categoryFilterPath, ICollection<string> transactionCategoryPath)
        {
            return categoryFilterPath.Count <= transactionCategoryPath.Count
                && categoryFilterPath.Zip(transactionCategoryPath, (c1, c2) => c1.Equals(c2, StringComparison.Ordinal)).All(eq => eq);
        }

    }
}
