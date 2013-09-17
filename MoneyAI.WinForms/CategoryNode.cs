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
        public string Name { get; private set; }

        public CategoryNode(string name)
        {
            Children = new Dictionary<string, CategoryNode>();
            Name = name;
        }

        public void Merge(string[] categoryPath)
        {
            var current = this;
            foreach (var category in categoryPath)
            {
                var found = current.Children.GetValueOrDefault(category);
                if (found == null)
                {
                    found = new CategoryNode(category);
                    current.Children.Add(category, found);
                }
                current = found;
            }
        }

        public void BuildTreeViewNodes(TreeNode treeViewNode, int year, int month, string[] parentCategoryPath = null)
        {
            foreach (var childCategoryNode in Children.Values)
            {
                var treeNodeData = new TreeNodeData()
                {
                    Text = childCategoryNode.Name,
                    YearFilter = year,
                    MonthFilter = month,
                    CategoryPathFilter = parentCategoryPath == null ? new string[] {childCategoryNode.Name} : parentCategoryPath.Concat(childCategoryNode.Name).ToArray()
                };
                var childTreeViewNode = CreateTreeNode(treeViewNode, treeNodeData);

                childCategoryNode.BuildTreeViewNodes(childTreeViewNode, year, month, treeNodeData.CategoryPathFilter);
            }
        }

        internal static TreeNode CreateTreeNode(TreeNode parentNode, TreeNodeData treeNodeData)
        {
            var node = new TreeNode(treeNodeData.Text);
            node.Tag = treeNodeData;

            if (parentNode != null)
                parentNode.Nodes.Add(node);
            return node;
        }
    }
}
