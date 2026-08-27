using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using System.Security.Principal;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI
{
    [DataContract]
    public class AuditInfo
    {
        [DataMember(IsRequired = true, Name = "createDate")]
        public DateTime CreateDate { get; private set; }

        [DataMember(IsRequired = true, Name = "createdBy")]
        public string CreatedBy { get; private set; }

        [DataMember(EmitDefaultValue = false, Name = "updateDate")]
        public DateTime? UpdateDate { get; private set; }

        [DataMember(EmitDefaultValue = false, Name = "updatedBy")]
        public string UpdatedBy { get; private set; }

        public AuditInfo(AuditInfo auditInfo, bool setUpdated, string updatedBy = null)
        {
            this.CreateDate = auditInfo.CreateDate;
            this.CreatedBy = auditInfo.CreatedBy;
            this.UpdateDate = setUpdated ? DateTime.UtcNow : auditInfo.UpdateDate;
            this.UpdatedBy = setUpdated ? (updatedBy ?? WindowsIdentity.GetCurrent().IfNotNull(i => i.Name)) : auditInfo.UpdatedBy;
        }

        public AuditInfo(string createdBy = null)
        {
            this.CreateDate = DateTime.UtcNow;
            this.CreatedBy = createdBy ?? WindowsIdentity.GetCurrent().IfNotNull(i => i.Name);
        }
    }
}
