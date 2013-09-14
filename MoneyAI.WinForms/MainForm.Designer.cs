namespace MoneyAI.WinForms
{
    partial class FormMain
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            this.components = new System.ComponentModel.Container();
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(FormMain));
            this.label1 = new System.Windows.Forms.Label();
            this.textBoxRootFolder = new System.Windows.Forms.TextBox();
            this.panel1 = new System.Windows.Forms.Panel();
            this.buttonSaveLatestMerged = new System.Windows.Forms.Button();
            this.buttonScanStatements = new System.Windows.Forms.Button();
            this.buttonAddAccount = new System.Windows.Forms.Button();
            this.splitter1 = new System.Windows.Forms.Splitter();
            this.splitContainer1 = new System.Windows.Forms.SplitContainer();
            this.splitContainer2 = new System.Windows.Forms.SplitContainer();
            this.txnTreeView = new System.Windows.Forms.TreeView();
            this.statusStrip1 = new System.Windows.Forms.StatusStrip();
            this.txnListView = new BrightIdeasSoftware.ObjectListView();
            this.olvColumnIsUserFlagged = ((BrightIdeasSoftware.OLVColumn)(new BrightIdeasSoftware.OLVColumn()));
            this.olvColumnCategory = ((BrightIdeasSoftware.OLVColumn)(new BrightIdeasSoftware.OLVColumn()));
            this.olvColumnTransactionDate = ((BrightIdeasSoftware.OLVColumn)(new BrightIdeasSoftware.OLVColumn()));
            this.olvColumnEntityName = ((BrightIdeasSoftware.OLVColumn)(new BrightIdeasSoftware.OLVColumn()));
            this.olvColumnAmount = ((BrightIdeasSoftware.OLVColumn)(new BrightIdeasSoftware.OLVColumn()));
            this.olvColumnType = ((BrightIdeasSoftware.OLVColumn)(new BrightIdeasSoftware.OLVColumn()));
            this.olvColumnAccountName = ((BrightIdeasSoftware.OLVColumn)(new BrightIdeasSoftware.OLVColumn()));
            this.olvColumnOriginalEntityName = ((BrightIdeasSoftware.OLVColumn)(new BrightIdeasSoftware.OLVColumn()));
            this.olvColumnImportInfo = ((BrightIdeasSoftware.OLVColumn)(new BrightIdeasSoftware.OLVColumn()));
            this.imageList = new System.Windows.Forms.ImageList(this.components);
            this.statusStrip2 = new System.Windows.Forms.StatusStrip();
            this.richTextBoxLog = new System.Windows.Forms.RichTextBox();
            this.panel1.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.splitContainer1)).BeginInit();
            this.splitContainer1.Panel1.SuspendLayout();
            this.splitContainer1.Panel2.SuspendLayout();
            this.splitContainer1.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.splitContainer2)).BeginInit();
            this.splitContainer2.Panel1.SuspendLayout();
            this.splitContainer2.Panel2.SuspendLayout();
            this.splitContainer2.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.txnListView)).BeginInit();
            this.SuspendLayout();
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Location = new System.Drawing.Point(3, 9);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(62, 13);
            this.label1.TabIndex = 0;
            this.label1.Text = "Root Folder";
            // 
            // textBoxRootFolder
            // 
            this.textBoxRootFolder.Location = new System.Drawing.Point(71, 9);
            this.textBoxRootFolder.Name = "textBoxRootFolder";
            this.textBoxRootFolder.Size = new System.Drawing.Size(340, 20);
            this.textBoxRootFolder.TabIndex = 1;
            // 
            // panel1
            // 
            this.panel1.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.panel1.Controls.Add(this.buttonSaveLatestMerged);
            this.panel1.Controls.Add(this.buttonScanStatements);
            this.panel1.Controls.Add(this.buttonAddAccount);
            this.panel1.Controls.Add(this.textBoxRootFolder);
            this.panel1.Controls.Add(this.label1);
            this.panel1.Dock = System.Windows.Forms.DockStyle.Top;
            this.panel1.Location = new System.Drawing.Point(0, 0);
            this.panel1.Name = "panel1";
            this.panel1.Size = new System.Drawing.Size(1045, 39);
            this.panel1.TabIndex = 2;
            // 
            // buttonSaveLatestMerged
            // 
            this.buttonSaveLatestMerged.Location = new System.Drawing.Point(551, 9);
            this.buttonSaveLatestMerged.Margin = new System.Windows.Forms.Padding(2);
            this.buttonSaveLatestMerged.Name = "buttonSaveLatestMerged";
            this.buttonSaveLatestMerged.Size = new System.Drawing.Size(126, 19);
            this.buttonSaveLatestMerged.TabIndex = 7;
            this.buttonSaveLatestMerged.Text = "Save Latest Merged";
            this.buttonSaveLatestMerged.UseVisualStyleBackColor = true;
            this.buttonSaveLatestMerged.Click += new System.EventHandler(this.buttonSaveLatestMerged_Click);
            // 
            // buttonScanStatements
            // 
            this.buttonScanStatements.Location = new System.Drawing.Point(416, 9);
            this.buttonScanStatements.Margin = new System.Windows.Forms.Padding(2);
            this.buttonScanStatements.Name = "buttonScanStatements";
            this.buttonScanStatements.Size = new System.Drawing.Size(124, 19);
            this.buttonScanStatements.TabIndex = 6;
            this.buttonScanStatements.Text = "Scan Statements";
            this.buttonScanStatements.UseVisualStyleBackColor = true;
            this.buttonScanStatements.Click += new System.EventHandler(this.buttonScanStatements_Click);
            // 
            // buttonAddAccount
            // 
            this.buttonAddAccount.Location = new System.Drawing.Point(869, 8);
            this.buttonAddAccount.Margin = new System.Windows.Forms.Padding(2);
            this.buttonAddAccount.Name = "buttonAddAccount";
            this.buttonAddAccount.Size = new System.Drawing.Size(127, 19);
            this.buttonAddAccount.TabIndex = 5;
            this.buttonAddAccount.Text = "Add Account...";
            this.buttonAddAccount.UseVisualStyleBackColor = true;
            this.buttonAddAccount.Click += new System.EventHandler(this.buttonAddAccount_Click);
            // 
            // splitter1
            // 
            this.splitter1.Location = new System.Drawing.Point(0, 39);
            this.splitter1.Name = "splitter1";
            this.splitter1.Size = new System.Drawing.Size(3, 571);
            this.splitter1.TabIndex = 3;
            this.splitter1.TabStop = false;
            // 
            // splitContainer1
            // 
            this.splitContainer1.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.splitContainer1.Dock = System.Windows.Forms.DockStyle.Fill;
            this.splitContainer1.Location = new System.Drawing.Point(3, 39);
            this.splitContainer1.Name = "splitContainer1";
            this.splitContainer1.Orientation = System.Windows.Forms.Orientation.Horizontal;
            // 
            // splitContainer1.Panel1
            // 
            this.splitContainer1.Panel1.Controls.Add(this.splitContainer2);
            // 
            // splitContainer1.Panel2
            // 
            this.splitContainer1.Panel2.Controls.Add(this.richTextBoxLog);
            this.splitContainer1.Size = new System.Drawing.Size(1042, 571);
            this.splitContainer1.SplitterDistance = 475;
            this.splitContainer1.TabIndex = 4;
            // 
            // splitContainer2
            // 
            this.splitContainer2.Dock = System.Windows.Forms.DockStyle.Fill;
            this.splitContainer2.Location = new System.Drawing.Point(0, 0);
            this.splitContainer2.Margin = new System.Windows.Forms.Padding(2);
            this.splitContainer2.Name = "splitContainer2";
            // 
            // splitContainer2.Panel1
            // 
            this.splitContainer2.Panel1.Controls.Add(this.txnTreeView);
            this.splitContainer2.Panel1.Controls.Add(this.statusStrip1);
            // 
            // splitContainer2.Panel2
            // 
            this.splitContainer2.Panel2.Controls.Add(this.txnListView);
            this.splitContainer2.Panel2.Controls.Add(this.statusStrip2);
            this.splitContainer2.Size = new System.Drawing.Size(1040, 473);
            this.splitContainer2.SplitterDistance = 345;
            this.splitContainer2.SplitterWidth = 3;
            this.splitContainer2.TabIndex = 0;
            // 
            // txnTreeView
            // 
            this.txnTreeView.Dock = System.Windows.Forms.DockStyle.Fill;
            this.txnTreeView.HideSelection = false;
            this.txnTreeView.Location = new System.Drawing.Point(0, 0);
            this.txnTreeView.Margin = new System.Windows.Forms.Padding(2);
            this.txnTreeView.Name = "txnTreeView";
            this.txnTreeView.Size = new System.Drawing.Size(345, 451);
            this.txnTreeView.TabIndex = 1;
            this.txnTreeView.AfterSelect += new System.Windows.Forms.TreeViewEventHandler(this.txnTreeView_AfterSelect);
            // 
            // statusStrip1
            // 
            this.statusStrip1.Location = new System.Drawing.Point(0, 451);
            this.statusStrip1.Name = "statusStrip1";
            this.statusStrip1.Padding = new System.Windows.Forms.Padding(1, 0, 10, 0);
            this.statusStrip1.Size = new System.Drawing.Size(345, 22);
            this.statusStrip1.TabIndex = 0;
            this.statusStrip1.Text = "statusStrip1";
            // 
            // txnListView
            // 
            this.txnListView.AllColumns.Add(this.olvColumnIsUserFlagged);
            this.txnListView.AllColumns.Add(this.olvColumnCategory);
            this.txnListView.AllColumns.Add(this.olvColumnTransactionDate);
            this.txnListView.AllColumns.Add(this.olvColumnEntityName);
            this.txnListView.AllColumns.Add(this.olvColumnAmount);
            this.txnListView.AllColumns.Add(this.olvColumnType);
            this.txnListView.AllColumns.Add(this.olvColumnAccountName);
            this.txnListView.AllColumns.Add(this.olvColumnOriginalEntityName);
            this.txnListView.AllColumns.Add(this.olvColumnImportInfo);
            this.txnListView.AllowColumnReorder = true;
            this.txnListView.Columns.AddRange(new System.Windows.Forms.ColumnHeader[] {
            this.olvColumnIsUserFlagged,
            this.olvColumnCategory,
            this.olvColumnTransactionDate,
            this.olvColumnEntityName,
            this.olvColumnAmount,
            this.olvColumnType,
            this.olvColumnAccountName,
            this.olvColumnOriginalEntityName,
            this.olvColumnImportInfo});
            this.txnListView.Dock = System.Windows.Forms.DockStyle.Fill;
            this.txnListView.EmptyListMsg = "Select item from the tree";
            this.txnListView.GridLines = true;
            this.txnListView.HeaderUsesThemes = false;
            this.txnListView.HideSelection = false;
            this.txnListView.IncludeColumnHeadersInCopy = true;
            this.txnListView.Location = new System.Drawing.Point(0, 0);
            this.txnListView.Name = "txnListView";
            this.txnListView.ShowCommandMenuOnRightClick = true;
            this.txnListView.Size = new System.Drawing.Size(692, 451);
            this.txnListView.SmallImageList = this.imageList;
            this.txnListView.TabIndex = 1;
            this.txnListView.UseCellFormatEvents = true;
            this.txnListView.UseCompatibleStateImageBehavior = false;
            this.txnListView.UseFilterIndicator = true;
            this.txnListView.UseFiltering = true;
            this.txnListView.View = System.Windows.Forms.View.Details;
            this.txnListView.AboutToCreateGroups += new System.EventHandler<BrightIdeasSoftware.CreateGroupsEventArgs>(this.txnListView_AboutToCreateGroups);
            this.txnListView.CellClick += new System.EventHandler<BrightIdeasSoftware.CellClickEventArgs>(this.txnListView_CellClick);
            this.txnListView.FormatCell += new System.EventHandler<BrightIdeasSoftware.FormatCellEventArgs>(this.txnListView_FormatCell);
            // 
            // olvColumnIsUserFlagged
            // 
            this.olvColumnIsUserFlagged.AspectName = "DisplayEmpty";
            this.olvColumnIsUserFlagged.AspectToStringFormat = "";
            this.olvColumnIsUserFlagged.AutoCompleteEditor = false;
            this.olvColumnIsUserFlagged.AutoCompleteEditorMode = System.Windows.Forms.AutoCompleteMode.None;
            this.olvColumnIsUserFlagged.CellPadding = null;
            this.olvColumnIsUserFlagged.HeaderImageKey = "flagColumn";
            this.olvColumnIsUserFlagged.HeaderTextAlign = System.Windows.Forms.HorizontalAlignment.Center;
            this.olvColumnIsUserFlagged.ImageAspectName = "DisplayIsUserFlaggedImageName";
            this.olvColumnIsUserFlagged.IsEditable = false;
            this.olvColumnIsUserFlagged.MinimumWidth = 20;
            this.olvColumnIsUserFlagged.ShowTextInHeader = false;
            this.olvColumnIsUserFlagged.Text = "";
            this.olvColumnIsUserFlagged.ToolTipText = "Flag the transaction for later review";
            this.olvColumnIsUserFlagged.Width = 20;
            // 
            // olvColumnCategory
            // 
            this.olvColumnCategory.AspectName = "DisplayCategory";
            this.olvColumnCategory.CellPadding = null;
            this.olvColumnCategory.FillsFreeSpace = true;
            this.olvColumnCategory.Text = "Category";
            // 
            // olvColumnTransactionDate
            // 
            this.olvColumnTransactionDate.AspectName = "TransactionDate";
            this.olvColumnTransactionDate.AspectToStringFormat = "{0:d}";
            this.olvColumnTransactionDate.CellPadding = null;
            this.olvColumnTransactionDate.FillsFreeSpace = true;
            this.olvColumnTransactionDate.Text = "Date";
            // 
            // olvColumnEntityName
            // 
            this.olvColumnEntityName.AspectName = "DisplayEntityNameNormalized";
            this.olvColumnEntityName.CellPadding = null;
            this.olvColumnEntityName.FillsFreeSpace = true;
            this.olvColumnEntityName.Text = "Entity";
            // 
            // olvColumnAmount
            // 
            this.olvColumnAmount.AspectName = "Amount";
            this.olvColumnAmount.AspectToStringFormat = "{0:C}";
            this.olvColumnAmount.CellPadding = null;
            this.olvColumnAmount.FillsFreeSpace = true;
            this.olvColumnAmount.Text = "Amount";
            // 
            // olvColumnType
            // 
            this.olvColumnType.AspectName = "DisplayType";
            this.olvColumnType.CellPadding = null;
            this.olvColumnType.Text = "Type";
            // 
            // olvColumnAccountName
            // 
            this.olvColumnAccountName.AspectName = "DisplayAccountName";
            this.olvColumnAccountName.CellPadding = null;
            this.olvColumnAccountName.Text = "Account";
            // 
            // olvColumnOriginalEntityName
            // 
            this.olvColumnOriginalEntityName.AspectName = "DisplayEntityNameOriginal";
            this.olvColumnOriginalEntityName.CellPadding = null;
            this.olvColumnOriginalEntityName.FillsFreeSpace = true;
            this.olvColumnOriginalEntityName.Text = "Original Entity Name";
            // 
            // olvColumnImportInfo
            // 
            this.olvColumnImportInfo.AspectName = "DisplayImportInfo";
            this.olvColumnImportInfo.CellPadding = null;
            this.olvColumnImportInfo.Text = "Source";
            // 
            // imageList
            // 
            this.imageList.ImageStream = ((System.Windows.Forms.ImageListStreamer)(resources.GetObject("imageList.ImageStream")));
            this.imageList.TransparentColor = System.Drawing.Color.Transparent;
            this.imageList.Images.SetKeyName(0, "flag");
            this.imageList.Images.SetKeyName(1, "flagColumn");
            this.imageList.Images.SetKeyName(2, "noflag");
            // 
            // statusStrip2
            // 
            this.statusStrip2.Location = new System.Drawing.Point(0, 451);
            this.statusStrip2.Name = "statusStrip2";
            this.statusStrip2.Padding = new System.Windows.Forms.Padding(1, 0, 10, 0);
            this.statusStrip2.Size = new System.Drawing.Size(692, 22);
            this.statusStrip2.TabIndex = 0;
            this.statusStrip2.Text = "statusStrip2";
            // 
            // richTextBoxLog
            // 
            this.richTextBoxLog.Dock = System.Windows.Forms.DockStyle.Fill;
            this.richTextBoxLog.Location = new System.Drawing.Point(0, 0);
            this.richTextBoxLog.Name = "richTextBoxLog";
            this.richTextBoxLog.Size = new System.Drawing.Size(1040, 90);
            this.richTextBoxLog.TabIndex = 0;
            this.richTextBoxLog.Text = "";
            // 
            // FormMain
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(1045, 610);
            this.Controls.Add(this.splitContainer1);
            this.Controls.Add(this.splitter1);
            this.Controls.Add(this.panel1);
            this.Name = "FormMain";
            this.Text = "MAI";
            this.WindowState = System.Windows.Forms.FormWindowState.Maximized;
            this.FormClosed += new System.Windows.Forms.FormClosedEventHandler(this.FormMain_FormClosed);
            this.Load += new System.EventHandler(this.FormMain_Load);
            this.panel1.ResumeLayout(false);
            this.panel1.PerformLayout();
            this.splitContainer1.Panel1.ResumeLayout(false);
            this.splitContainer1.Panel2.ResumeLayout(false);
            ((System.ComponentModel.ISupportInitialize)(this.splitContainer1)).EndInit();
            this.splitContainer1.ResumeLayout(false);
            this.splitContainer2.Panel1.ResumeLayout(false);
            this.splitContainer2.Panel1.PerformLayout();
            this.splitContainer2.Panel2.ResumeLayout(false);
            this.splitContainer2.Panel2.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.splitContainer2)).EndInit();
            this.splitContainer2.ResumeLayout(false);
            ((System.ComponentModel.ISupportInitialize)(this.txnListView)).EndInit();
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.TextBox textBoxRootFolder;
        private System.Windows.Forms.Panel panel1;
        private System.Windows.Forms.Splitter splitter1;
        private System.Windows.Forms.SplitContainer splitContainer1;
        private System.Windows.Forms.RichTextBox richTextBoxLog;
        private System.Windows.Forms.Button buttonAddAccount;
        private System.Windows.Forms.Button buttonScanStatements;
        private System.Windows.Forms.Button buttonSaveLatestMerged;
        private System.Windows.Forms.SplitContainer splitContainer2;
        private System.Windows.Forms.TreeView txnTreeView;
        private System.Windows.Forms.StatusStrip statusStrip1;
        private System.Windows.Forms.StatusStrip statusStrip2;
        private BrightIdeasSoftware.ObjectListView txnListView;
        private BrightIdeasSoftware.OLVColumn olvColumnCategory;
        private BrightIdeasSoftware.OLVColumn olvColumnTransactionDate;
        private BrightIdeasSoftware.OLVColumn olvColumnAmount;
        private BrightIdeasSoftware.OLVColumn olvColumnEntityName;
        private BrightIdeasSoftware.OLVColumn olvColumnAccountName;
        private BrightIdeasSoftware.OLVColumn olvColumnOriginalEntityName;
        private BrightIdeasSoftware.OLVColumn olvColumnImportInfo;
        private BrightIdeasSoftware.OLVColumn olvColumnType;
        private BrightIdeasSoftware.OLVColumn olvColumnIsUserFlagged;
        private System.Windows.Forms.ImageList imageList;
    }
}

