namespace MoneyAI
{
    public enum ContentType
    {
        Csv,
        Json,
        None
    }

    public interface ILocation
    {
        string Address { get; }
        string PortableAddress { get; }
        ImportInfo ImportInfo { get; }
        ContentType ContentType { get; }
        AccountConfig AccountConfig { get; }
    }
}