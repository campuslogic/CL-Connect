using System;
using System.Collections.Generic;

namespace CampusLogicEvents.Web.Results
{
	public class ImportErrorInfo
	{
		public int RowNum;
		public string RowData;
		public string ErrorMessage;
	}

	public class ImportResult
	{
		public int NumRowsScanned;
		public int NumStudentsImported;
		public int NumErrors;
		public List<ImportErrorInfo> TopErrors = new List<ImportErrorInfo>();
	}
}