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
        [DataMember(IsRequired = true)]
        public DateTime CreateDate { get; private set; }
        [DataMember(IsRequired = true)]
        public string CreatedBy { get; private set; }
        [DataMember(EmitDefaultValue = false)]
        public DateTime? UpdateDate { get; private set; }
        [DataMember(EmitDefaultValue = false)]
        public string UpdatedBy { get; private set; }

        private AuditInfo()
        {
            
        }

        public static AuditInfo Create(string createdBy = null)
        {
            var auditInfo = new AuditInfo();
            auditInfo.CreateDate = DateTime.UtcNow;
            auditInfo.CreatedBy = createdBy ?? WindowsIdentity.GetCurrent().IfNotNull(i => i.Name);

            return auditInfo;
        }

        public void Update(string updatedBy)
        {
            this.UpdateDate = DateTime.UtcNow;
            this.UpdatedBy = updatedBy;
        }
    }
}
