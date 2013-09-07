﻿using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.Linq;
using System.Windows.Forms;
using BrightIdeasSoftware;
using CommonUtils;
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
        System.Globalization.DateTimeFormatInfo dateTimeFormatInfo = new System.Globalization.DateTimeFormatInfo();
        private void FormMain_Load(object sender, EventArgs e)
        {
            MessagePipe.AddListner(UpdateLog, listnerKey: "FormMain");
            defaultRootPath = Settings.Default.RootFolder.NullIfEmpty();
            textBoxRootFolder.Text = defaultRootPath;

            txnListView.BeforeCreatingGroups += txnListView_BeforeCreatingGroups;

            buttonScanStatements_Click(sender, e);
        }

        private class CategoryGroupComparer : IComparer<BrightIdeasSoftware.OLVGroup>
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

        private class TransactionItemComparer : IComparer<BrightIdeasSoftware.OLVListItem>
        {
            public static readonly TransactionItemComparer Comparer = new TransactionItemComparer();
            public int Compare(OLVListItem x, OLVListItem y)
            {
                return ((Transaction)x.RowObject).Amount.CompareTo(((Transaction)y.RowObject).Amount);
            }
        }

        private void txnListView_BeforeCreatingGroups(object sender, BrightIdeasSoftware.CreateGroupsEventArgs e)
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
                var repository = new DiskTransactionRepository(defaultRootPath);
                appState = new AppState(repository);
                appState.Load();
            }

            appState.MergeNewStatements();

            RefreshExplorer();
        }
        
        private void buttonSaveLatestMerged_Click(object sender, EventArgs e)
        {
            appState.Save();
        }

        private void RefreshExplorer()
        {
            this.txnTreeView.Nodes.Clear();
            var rootNode = CategoryNode.CreateTreeNode(new TreeNodeData()
            {
                Text = "All"
            } );
            this.txnTreeView.Nodes.Add(rootNode);

            var yearGroups = this.appState.LatestMerged
                .GroupBy(t => t.TransactionDate.Year)
                .OrderByDescending(g => g.Key)
                .Select(g => 
                    Tuple.Create(g.Key
                        , g.GroupBy(yt => yt.TransactionDate.Month)
                            .Select(mg => Tuple.Create(mg.Key, mg.ToArray()))
                            .OrderByDescending(m => m)));

            var selectedNode = txnTreeView.SelectedNode;
            foreach (var yearGroup in yearGroups)
            {
                var yearNode = CategoryNode.CreateTreeNode(new TreeNodeData()
                {
                    Text = yearGroup.Item1.ToStringCurrentCulture(), YearFilter = yearGroup.Item1
                });
                rootNode.Nodes.Add(yearNode);

                foreach (var monthGroup in yearGroup.Item2)
                {
                    var monthNode = CategoryNode.CreateTreeNode(new TreeNodeData()
                    {
                        Text = CultureInfo.CurrentCulture.DateTimeFormat.GetAbbreviatedMonthName(monthGroup.Item1), YearFilter = yearGroup.Item1, MonthFilter = monthGroup.Item1
                    });
                    yearNode.Nodes.Add(monthNode);

                    var categoryRootNode = new CategoryNode(null, yearGroup.Item1, monthGroup.Item1);
                    foreach (var transaction in monthGroup.Item2)
                        categoryRootNode.Merge(transaction);

                    categoryRootNode.BuildTreeViewNodes(monthNode);

                    if (selectedNode == null)
                        selectedNode = monthNode;
                }

                yearNode.Expand();
            }

            rootNode.Expand();

            if (selectedNode != null)
            {
                txnTreeView.SelectedNode = selectedNode;
                txnTreeView.Focus();
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
                    && (filter.CategoryPathFilter == null || IsCategoryPathMatch(filter.CategoryPathFilter, t.DisplayCategoryPath)));

                txnListView.SetObjects(filteredTransactions);
            }
            else txnListView.ClearObjects();
            txnListView.Sort(olvColumnCategory);
        }

        private bool IsCategoryPathMatch(IEnumerable<string> path1, IEnumerable<string> path2)
        {
            return path1.Zip(path2, (c1, c2) => c1.Equals(c2, StringComparison.Ordinal)).Any(e => !e);
        }

        private void txnListView_FormatCell(object sender, BrightIdeasSoftware.FormatCellEventArgs e)
        {
            if (e.Column == olvColumnAmount)
            {
                var transaction = (Transaction) e.Model;
                if (transaction.Amount < 0)
                    e.SubItem.ForeColor = Color.Red;
            }
        }

        private void txnListView_AboutToCreateGroups(object sender, BrightIdeasSoftware.CreateGroupsEventArgs e)
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
            string totalsText = transactions
                .GroupBy(t => t.TransactionReason)
                .Select(g => Tuple.Create(g.Key, g.Sum(t => t.Amount)))
                .Where(tp => tp.Item2 != 0)
                .OrderBy(tp => Math.Abs(tp.Item2))
                .ToDelimitedString("    ", tp => string.Concat(tp.Item1.ToString(), " ", Math.Abs(tp.Item2).ToString("C")), true);
            int count = transactions.Count;
            decimal negativeSum = Math.Abs(transactions.Where(t => t.Amount < 0).Sum(t => t.Amount));
            decimal positiveSum = transactions.Where(t => t.Amount > 0).Sum(t => t.Amount);
            return Tuple.Create(totalsText, count, negativeSum, positiveSum);
        }

        private void txnListView_CellClick(object sender, CellClickEventArgs e)
        {
            if (e.Column == olvColumnIsUserFlagged)
            {
                var tx = (Transaction) e.Model;
                //tx.IsUserFlagged = !tx.IsUserFlagged;
                e.ListView.RefreshItem(e.Item);
            }
        }
    }
}
