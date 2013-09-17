using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.Linq;
using System.Windows.Forms;
using BrightIdeasSoftware;
using CommonUtils;
using MoneyAI.Repositories;
using MoneyAI.WinForms.Properties;

namespace MoneyAI.WinForms
{
    public partial class FormMain : Form
    {
        public FormMain()
        {
            InitializeComponent();
        }

        private string defaultRootPath;
        private AppState appState;
        private void FormMain_Load(object sender, EventArgs e)
        {
            MessagePipe.AddListner(UpdateLog, listnerKey: "FormMain");
            defaultRootPath = Settings.Default.RootFolder.NullIfEmpty();
            textBoxRootFolder.Text = defaultRootPath;

            txnListView.BeforeCreatingGroups += txnListView_BeforeCreatingGroups;

            buttonScanStatements_Click(sender, e);
        }

        private class CategoryGroupComparer : IComparer<OLVGroup>
        {
            public static readonly CategoryGroupComparer Comparer = new CategoryGroupComparer();
            public int Compare(OLVGroup x, OLVGroup y)
            {
                EnsureGroupTag(x);
                EnsureGroupTag(y);
                Tuple<string, int, decimal, decimal> xt = (Tuple<string, int, decimal, decimal>)x.Tag, yt = (Tuple<string, int, decimal, decimal>)y.Tag;

                return Math.Max(yt.Item4, yt.Item3).CompareTo(Math.Max(xt.Item3, xt.Item3));
            }
        }

        private static void EnsureGroupTag(OLVGroup group)
        {
            if (group.Tag == null)
            {
                var groupStats = GetGroupHeaderTotals(@group.Items.Select(i => (Transaction)i.RowObject).ToArray());
                group.Tag = groupStats;
            }
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

        private void FormMain_FormClosed(object sender, FormClosedEventArgs e)
        {
            MessagePipe.RemoveListner("FormMain");

            if (textBoxRootFolder.Text != defaultRootPath)
            {
                Settings.Default.RootFolder = textBoxRootFolder.Text;
                Settings.Default.Save();
            }
        }


        private void UpdateLog(object message)
        {
            richTextBoxLog.AppendText(message.ToString());
            richTextBoxLog.AppendText("\n");
        }

        private void buttonAddAccount_Click(object sender, EventArgs e)
        {
            var accountConfig = AccountConfigDialog.GetNewAccountInfo(this);
            if (accountConfig != null)
                appState.AddAccountConfig(accountConfig);
        }

        private void buttonScanStatements_Click(object sender, EventArgs e)
        {
            if (appState == null)
            {
                var repository = new FileRepository(defaultRootPath);
                appState = new AppState(repository);
                appState.LoadLatestMerged();
            }

            appState.MergeNewStatements();

            RefreshExplorer(this.appState.LatestMerged);
        }
        
        private void buttonSaveLatestMerged_Click(object sender, EventArgs e)
        {
            appState.SaveLatestMerged();
        }

        private static string GetMonthDisplayName(int month)
        {
            return CultureInfo.CurrentCulture.DateTimeFormat.GetAbbreviatedMonthName(month);
        }

        private static void RefreshNode(TreeNode treeNode, Transactions allTransactions, IEnumerable<Transaction> parentTransactions = null)
        {
            var isExpanded = treeNode.IsExpanded;
            var treeNodeData = (TreeNodeData) treeNode.Tag;
            if (treeNodeData.YearFilter == null)
            {
                var yearGroups = allTransactions.GroupBy(t => t.TransactionDate.Year).OrderByDescending(g => g.Key);
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
                parentTransactions = parentTransactions ?? allTransactions.Where(t => t.TransactionDate.Year == year);
                var monthGroups = parentTransactions.GroupBy(t => t.TransactionDate.Month).OrderByDescending(g => g.Key);
                foreach (var monthGroup in monthGroups)
                {
                    var monthTreeNode = CategoryNode.CreateTreeNode(treeNode, new TreeNodeData()
                        {
                            Text = GetMonthDisplayName(monthGroup.Key), YearFilter = year, MonthFilter = monthGroup.Key
                        });
                    RefreshNode(monthTreeNode, allTransactions, monthGroup.Select(t => t));
                }
            }
            else
            {
                var year = treeNodeData.YearFilter.Value;
                var month = treeNodeData.MonthFilter.Value;

                parentTransactions = parentTransactions ?? allTransactions.Where(t => t.TransactionDate.Year == year).Where(t => t.TransactionDate.Month == month);

                var categoryPaths = parentTransactions.Select(t => t.CategoryPath);

                var rootCategoryNode = new CategoryNode(null);

                foreach (var categoryPath in categoryPaths)
                    rootCategoryNode.Merge(categoryPath);

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
                var filter = (TreeNodeData) txnTreeView.SelectedNode.Tag;
                var filteredTransactions = appState.LatestMerged.Where(t => 
                    (filter.YearFilter == null || t.TransactionDate.Year == filter.YearFilter.Value)
                    && (filter.MonthFilter == null || t.TransactionDate.Month == filter.MonthFilter.Value)
                    && (filter.CategoryPathFilter == null || IsCategoryPathMatch(filter.CategoryPathFilter, t.CategoryPath)));

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

        private void txnListView_FormatCell(object sender, FormatCellEventArgs e)
        {
            if (e.Column == olvColumnAmount)
            {
                var transaction = (Transaction) e.Model;
                if (transaction.Amount < 0)
                    e.SubItem.ForeColor = Color.Red;
            }
        }

        private void txnListView_AboutToCreateGroups(object sender, CreateGroupsEventArgs e)
        {
            if (e.Parameters.GroupByColumn == olvColumnCategory)
            {
                foreach (var group in e.Groups)
                {
                    EnsureGroupTag(group);

                    var groupStats = (Tuple<string, int, decimal, decimal>) group.Tag;
                    var totalsText = groupStats.Item1;
                    var count = groupStats.Item2;

                    group.Header = "{0} - {1} {2}".FormatEx((string) group.Key, count, totalsText);
                    group.Footer = " ";
                    group.Subtitle = " ";
                    //group.Collapsed = true;
                }
            }
        }

        private static Tuple<string, int, decimal, decimal> GetGroupHeaderTotals(ICollection<Transaction> transactions)
        {
            var totalsText = transactions
                .GroupBy(t => t.TransactionReason)
                .Select(g => Tuple.Create(g.Key, g.Sum(t => t.Amount)))
                .Where(tp => tp.Item2 != 0)
                .OrderBy(tp => Math.Abs(tp.Item2))
                .ToDelimitedString("    ", tp => string.Concat(tp.Item1.ToString(), " ", Math.Abs(tp.Item2).ToString("C")), true);
            var count = transactions.Count;
            var negativeSum = Math.Abs(transactions.Where(t => t.Amount < 0).Sum(t => t.Amount));
            var positiveSum = transactions.Where(t => t.Amount > 0).Sum(t => t.Amount);
            return Tuple.Create(totalsText, count, negativeSum, positiveSum);
        }

        private void txnListView_CellClick(object sender, CellClickEventArgs e)
        {
            if (e.Column == olvColumnIsUserFlagged)
                ToggleFlagsRows(e.Item.AsEnumerable(), appState.LatestMerged);
        }

        private void FormMain_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Insert)
            {
                ToggleFlagsRows(txnListView.SelectedItems, appState.LatestMerged);
                e.Handled = true;
                e.SuppressKeyPress = true;
            }
            else if (e.Control && e.KeyCode == Keys.N)
            {
                ApplyNoteForRows(txnListView.SelectedItems, appState.LatestMerged);
                e.Handled = true;
                e.SuppressKeyPress = true;
            }
            else if (e.KeyCode == Keys.F2)
            {
                ApplyCategoryForRows(txnListView.SelectedItems);
                e.Handled = true;
                e.SuppressKeyPress = true;
            }
        }

        private void ApplyNoteForRows(IList rows, Transactions transactions)
        {
            if (rows.Count == 0)
                return;

            var currentNote = ((Transaction) ((OLVListItem) rows[0]).RowObject).Note;
            var newNote = NoteDialogForm.GetNoteFromUser(currentNote, this);

            if (currentNote == newNote)
                return;

            RefreshItems(rows, tx => transactions.SetNote(tx, newNote).ToVoid());
        }

        private void ApplyCategoryForRows(IList rows)
        {
            if (rows.Count == 0)
                return;

            var firstTx = (Transaction) ((OLVListItem) rows[0]).RowObject;
            var lastCategoryEdit = this.appState.LatestMerged.GetEditsDescending(firstTx)
                .FirstOrDefault(edit => edit.Values.IfNotNull(v => v.CategoryPath.GetValueOrDefault()) != null);

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
    }
}
