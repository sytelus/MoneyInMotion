using System;
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
            this.treeView.Nodes.Clear();
            var rootNode = CreateTreeNode("All", new TreeNodeFilter() {Type = TreeNodeFilter.FilterType.None, Value = null} );
            this.treeView.Nodes.Add(rootNode);

            var dateGroups = this.appState.LatestMerged
                .GroupBy(t => t.TransactionDate.Year)
                .OrderByDescending(g => g.Key)
                .Select(g => 
                    Tuple.Create(g.Key
                        , g.GroupBy(yt => yt.TransactionDate.Month)
                            .OrderByDescending(mg => mg.Key)
                            .Select(mg => Tuple.Create(mg.Key, mg.ToArray()))
                        .ToArray()));

            foreach (var dateGroup in dateGroups)
            {
                var yearNode = CreateTreeNode(dateGroup.Item1.ToString(), new TreeNodeFilter() {Type = TreeNodeFilter.FilterType.Year, Value = dateGroup.Item1});
                rootNode.Nodes.Add(yearNode);

                foreach (var monthGroup in dateGroup.Item2)
                {
                    var monthNode = CreateTreeNode(monthGroup.Item1.ToString(), new TreeNodeFilter() { Type = TreeNodeFilter.FilterType.Month, Value = monthGroup.Item1 });
                    yearNode.Nodes.Add(monthNode);
                    

                }
            }
        }

        private static TreeNode CreateTreeNode(string text, TreeNodeFilter filter, TreeNode[] children = null, TreeNode parentNode = null, bool collapse = false)
        {
            var node = new TreeNode(text);
            node.Tag = filter;

            if (parentNode != null)
                parentNode.Nodes.Add(node);

            if (children != null)
                node.Nodes.AddRange(children);

            if (!collapse)
                node.Expand();

            return node;
        }
    }
}
