using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices.ComTypes;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using CommonUtils;

namespace MoneyAI.WinForms
{
    internal class CategoryNode
    {
        public IDictionary<string, CategoryNode> Children { get; private set; }
        public List<Transaction> Transactions { get; private set; }
        public string Name { get; private set; }
        public int? Year { get; set; }
        public int? Month { get; set; }

        public CategoryNode(string name, int? year, int? month)
        {
            Children = new Dictionary<string, CategoryNode>();
            Name = name;
            Year = year;
            Month = month;
            Transactions = new List<Transaction>();
        }

        public void Merge(Transaction transaction)
        {
            var categoryPath = transaction.CategoryPath;

            var current = this;
            foreach (var category in categoryPath)
            {
                var found = current.Children.GetValueOrDefault(category);
                if (found == null)
                {
                    found = new CategoryNode(category, Year, Month);
                    current.Children.Add(category, found);
                }
                found.Transactions.Add(transaction);
                current = found;
            }
        }

        public decimal GetTransationAmountSum()
        {
            return Transactions.Sum(t => t.Amount);
        }

        public void BuildTreeViewNodes(TreeNode treeViewNode, List<string> categoryPath = null)
        {
            categoryPath = categoryPath ?? (Name == null ? null : new List<string>() {Name});

            foreach (var childCategoryNode in Children.Values.OrderBy(c => c.GetTransationAmountSum()))
            {
                var childTreeViewNode = CreateTreeNode(
                    new TreeNodeData()
                    {
                        Text = childCategoryNode.Name,
                        YearFilter = Year,
                        MonthFilter = Month,
                        CategoryPathFilter = categoryPath.IfNotNull(c => c.ToArray())
                    });
                treeViewNode.Nodes.Add(childTreeViewNode);

                childCategoryNode.BuildTreeViewNodes(childTreeViewNode, categoryPath);
            }
        }

        internal static TreeNode CreateTreeNode(TreeNodeData treeNodeData)
        {
            var node = new TreeNode(treeNodeData.Text);
            node.Tag = treeNodeData;

            return node;
        }
    }
}
