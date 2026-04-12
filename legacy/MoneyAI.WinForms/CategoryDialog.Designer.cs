namespace MoneyAI.WinForms
{
    partial class CategoryDialogForm
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
            this.panel1 = new System.Windows.Forms.Panel();
            this.panel2 = new System.Windows.Forms.Panel();
            this.panel3 = new System.Windows.Forms.Panel();
            this.panel4 = new System.Windows.Forms.Panel();
            this.buttonCancel = new System.Windows.Forms.Button();
            this.buttonOK = new System.Windows.Forms.Button();
            this.groupBox1 = new System.Windows.Forms.GroupBox();
            this.groupBox2 = new System.Windows.Forms.GroupBox();
            this.textBoxNameWords = new System.Windows.Forms.TextBox();
            this.radioButtonOnlySelected = new System.Windows.Forms.RadioButton();
            this.radioButtonNameWords = new System.Windows.Forms.RadioButton();
            this.radioButtonName = new System.Windows.Forms.RadioButton();
            this.radioButtonNormalizedName = new System.Windows.Forms.RadioButton();
            this.groupBox3 = new System.Windows.Forms.GroupBox();
            this.labelTip = new System.Windows.Forms.Label();
            this.textBoxCategory = new System.Windows.Forms.TextBox();
            this.panel4.SuspendLayout();
            this.groupBox2.SuspendLayout();
            this.groupBox3.SuspendLayout();
            this.SuspendLayout();
            // 
            // panel1
            // 
            this.panel1.Dock = System.Windows.Forms.DockStyle.Top;
            this.panel1.Location = new System.Drawing.Point(10, 0);
            this.panel1.Name = "panel1";
            this.panel1.Size = new System.Drawing.Size(608, 10);
            this.panel1.TabIndex = 5;
            // 
            // panel2
            // 
            this.panel2.Dock = System.Windows.Forms.DockStyle.Left;
            this.panel2.Location = new System.Drawing.Point(0, 0);
            this.panel2.Name = "panel2";
            this.panel2.Size = new System.Drawing.Size(10, 294);
            this.panel2.TabIndex = 6;
            // 
            // panel3
            // 
            this.panel3.Dock = System.Windows.Forms.DockStyle.Right;
            this.panel3.Location = new System.Drawing.Point(618, 0);
            this.panel3.Name = "panel3";
            this.panel3.Size = new System.Drawing.Size(10, 294);
            this.panel3.TabIndex = 7;
            // 
            // panel4
            // 
            this.panel4.Controls.Add(this.buttonCancel);
            this.panel4.Controls.Add(this.buttonOK);
            this.panel4.Controls.Add(this.groupBox1);
            this.panel4.Dock = System.Windows.Forms.DockStyle.Bottom;
            this.panel4.Location = new System.Drawing.Point(10, 218);
            this.panel4.Name = "panel4";
            this.panel4.Size = new System.Drawing.Size(608, 76);
            this.panel4.TabIndex = 8;
            // 
            // buttonCancel
            // 
            this.buttonCancel.DialogResult = System.Windows.Forms.DialogResult.Cancel;
            this.buttonCancel.Location = new System.Drawing.Point(474, 24);
            this.buttonCancel.Name = "buttonCancel";
            this.buttonCancel.Size = new System.Drawing.Size(125, 40);
            this.buttonCancel.TabIndex = 8;
            this.buttonCancel.Text = "Cancel";
            this.buttonCancel.UseVisualStyleBackColor = true;
            // 
            // buttonOK
            // 
            this.buttonOK.DialogResult = System.Windows.Forms.DialogResult.OK;
            this.buttonOK.Location = new System.Drawing.Point(328, 24);
            this.buttonOK.Name = "buttonOK";
            this.buttonOK.Size = new System.Drawing.Size(125, 40);
            this.buttonOK.TabIndex = 7;
            this.buttonOK.Text = "OK";
            this.buttonOK.UseVisualStyleBackColor = true;
            // 
            // groupBox1
            // 
            this.groupBox1.Location = new System.Drawing.Point(2, -1);
            this.groupBox1.Name = "groupBox1";
            this.groupBox1.Size = new System.Drawing.Size(604, 10);
            this.groupBox1.TabIndex = 5;
            this.groupBox1.TabStop = false;
            // 
            // groupBox2
            // 
            this.groupBox2.Controls.Add(this.textBoxNameWords);
            this.groupBox2.Controls.Add(this.radioButtonOnlySelected);
            this.groupBox2.Controls.Add(this.radioButtonNameWords);
            this.groupBox2.Controls.Add(this.radioButtonName);
            this.groupBox2.Controls.Add(this.radioButtonNormalizedName);
            this.groupBox2.Location = new System.Drawing.Point(10, 12);
            this.groupBox2.Name = "groupBox2";
            this.groupBox2.Size = new System.Drawing.Size(606, 135);
            this.groupBox2.TabIndex = 9;
            this.groupBox2.TabStop = false;
            this.groupBox2.Text = "Apply To";
            // 
            // textBoxNameWords
            // 
            this.textBoxNameWords.Location = new System.Drawing.Point(337, 54);
            this.textBoxNameWords.Name = "textBoxNameWords";
            this.textBoxNameWords.Size = new System.Drawing.Size(265, 22);
            this.textBoxNameWords.TabIndex = 4;
            // 
            // radioButtonOnlySelected
            // 
            this.radioButtonOnlySelected.AutoSize = true;
            this.radioButtonOnlySelected.Location = new System.Drawing.Point(11, 81);
            this.radioButtonOnlySelected.Name = "radioButtonOnlySelected";
            this.radioButtonOnlySelected.Size = new System.Drawing.Size(288, 21);
            this.radioButtonOnlySelected.TabIndex = 3;
            this.radioButtonOnlySelected.Text = "Only {0} currently selected transaction{1}";
            this.radioButtonOnlySelected.UseVisualStyleBackColor = true;
            // 
            // radioButtonNameWords
            // 
            this.radioButtonNameWords.AutoSize = true;
            this.radioButtonNameWords.Location = new System.Drawing.Point(11, 54);
            this.radioButtonNameWords.Name = "radioButtonNameWords";
            this.radioButtonNameWords.Size = new System.Drawing.Size(313, 21);
            this.radioButtonNameWords.TabIndex = 2;
            this.radioButtonNameWords.Text = "All transactions that contains following words:";
            this.radioButtonNameWords.UseVisualStyleBackColor = true;
            this.radioButtonNameWords.CheckedChanged += new System.EventHandler(this.radioButtonNameWords_CheckedChanged);
            // 
            // radioButtonName
            // 
            this.radioButtonName.AutoSize = true;
            this.radioButtonName.Location = new System.Drawing.Point(11, 108);
            this.radioButtonName.Name = "radioButtonName";
            this.radioButtonName.Size = new System.Drawing.Size(168, 21);
            this.radioButtonName.TabIndex = 4;
            this.radioButtonName.Text = "All transactions for {0}";
            this.radioButtonName.UseVisualStyleBackColor = true;
            // 
            // radioButtonNormalizedName
            // 
            this.radioButtonNormalizedName.AutoSize = true;
            this.radioButtonNormalizedName.Checked = true;
            this.radioButtonNormalizedName.Location = new System.Drawing.Point(11, 27);
            this.radioButtonNormalizedName.Name = "radioButtonNormalizedName";
            this.radioButtonNormalizedName.Size = new System.Drawing.Size(168, 21);
            this.radioButtonNormalizedName.TabIndex = 0;
            this.radioButtonNormalizedName.TabStop = true;
            this.radioButtonNormalizedName.Text = "All transactions for {0}";
            this.radioButtonNormalizedName.UseVisualStyleBackColor = true;
            // 
            // groupBox3
            // 
            this.groupBox3.Controls.Add(this.labelTip);
            this.groupBox3.Controls.Add(this.textBoxCategory);
            this.groupBox3.Location = new System.Drawing.Point(16, 153);
            this.groupBox3.Name = "groupBox3";
            this.groupBox3.Size = new System.Drawing.Size(596, 74);
            this.groupBox3.TabIndex = 10;
            this.groupBox3.TabStop = false;
            this.groupBox3.Text = "Category";
            // 
            // labelTip
            // 
            this.labelTip.AutoSize = true;
            this.labelTip.BackColor = System.Drawing.SystemColors.Info;
            this.labelTip.ForeColor = System.Drawing.SystemColors.InfoText;
            this.labelTip.Location = new System.Drawing.Point(6, 51);
            this.labelTip.Name = "labelTip";
            this.labelTip.Size = new System.Drawing.Size(459, 17);
            this.labelTip.TabIndex = 1;
            this.labelTip.Text = "Tip: Use > to create hierarchy. For example, Food > Eating Out > Lunch";
            // 
            // textBoxCategory
            // 
            this.textBoxCategory.Location = new System.Drawing.Point(6, 21);
            this.textBoxCategory.Name = "textBoxCategory";
            this.textBoxCategory.Size = new System.Drawing.Size(590, 22);
            this.textBoxCategory.TabIndex = 2;
            this.textBoxCategory.TextChanged += new System.EventHandler(this.textBoxCategory_TextChanged);
            // 
            // CategoryDialogForm
            // 
            this.AcceptButton = this.buttonOK;
            this.AutoScaleDimensions = new System.Drawing.SizeF(8F, 16F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.CancelButton = this.buttonCancel;
            this.ClientSize = new System.Drawing.Size(628, 294);
            this.Controls.Add(this.groupBox3);
            this.Controls.Add(this.groupBox2);
            this.Controls.Add(this.panel4);
            this.Controls.Add(this.panel1);
            this.Controls.Add(this.panel3);
            this.Controls.Add(this.panel2);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedDialog;
            this.KeyPreview = true;
            this.Name = "CategoryDialogForm";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterParent;
            this.Text = "Category Rule";
            this.Load += new System.EventHandler(this.CategoryDialogForm_Load);
            this.panel4.ResumeLayout(false);
            this.groupBox2.ResumeLayout(false);
            this.groupBox2.PerformLayout();
            this.groupBox3.ResumeLayout(false);
            this.groupBox3.PerformLayout();
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.Panel panel1;
        private System.Windows.Forms.Panel panel2;
        private System.Windows.Forms.Panel panel3;
        private System.Windows.Forms.Panel panel4;
        private System.Windows.Forms.Button buttonCancel;
        private System.Windows.Forms.Button buttonOK;
        private System.Windows.Forms.GroupBox groupBox1;
        private System.Windows.Forms.GroupBox groupBox2;
        private System.Windows.Forms.RadioButton radioButtonOnlySelected;
        private System.Windows.Forms.RadioButton radioButtonNameWords;
        private System.Windows.Forms.RadioButton radioButtonName;
        private System.Windows.Forms.RadioButton radioButtonNormalizedName;
        private System.Windows.Forms.TextBox textBoxNameWords;
        private System.Windows.Forms.GroupBox groupBox3;
        private System.Windows.Forms.Label labelTip;
        private System.Windows.Forms.TextBox textBoxCategory;
    }
}