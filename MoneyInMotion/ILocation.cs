namespace MoneyInMotion
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
        string ContentHash { get; }
        ContentType ContentType { get; }
        AccountConfig AccountConfig { get; }
    }
}