using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Windows.Forms;
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

            buttonScanStatements_Click(sender, e);
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
                    && (filter.CategoryPathFilter == null || IsCategoryPathMatch(filter.CategoryPathFilter, t.DisplayCategoryPath)))
                    .OrderBy(t => t.Amount);

                txnListView.SetObjects(filteredTransactions);


            }
            else txnListView.ClearObjects();
        }

        private bool IsCategoryPathMatch(IEnumerable<string> path1, IEnumerable<string> path2)
        {
            return path1.Zip(path2, (c1, c2) => c1.Equals(c2, StringComparison.Ordinal)).Any(e => !e);
        }

    }
}
