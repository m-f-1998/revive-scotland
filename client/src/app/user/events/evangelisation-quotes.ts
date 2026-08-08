export interface EvangelisationQuote {
  text: string
  author: string
}

export const EVANGELISATION_QUOTES: EvangelisationQuote [ ] = [
  {
    text: "Go therefore and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit.",
    author: "Matthew 28:19"
  },
  {
    text: "The Church exists in order to evangelize.",
    author: "Pope Paul VI, Evangelii Nuntiandi"
  },
  {
    text: "Prayer, as a means of drawing ever new strength from Christ, is concretely and urgently needed.",
    author: "Pope Benedict XVI"
  },
  {
    text: "Every Christian is a missionary to the extent that he or she has encountered the love of God in Christ Jesus.",
    author: "Pope Francis, Evangelii Gaudium"
  },
  {
    text: "Do not be afraid. Open wide the doors for Christ.",
    author: "Pope St. John Paul II"
  },
  {
    text: "The Gospel must not be kept hidden because of a false sense of modesty.",
    author: "Pope Francis, Evangelii Gaudium"
  },
  {
    text: "Modern man listens more willingly to witnesses than to teachers, and if he does listen to teachers, it is because they are witnesses.",
    author: "Pope Paul VI, Evangelii Nuntiandi"
  },
  {
    text: "The world needs the witness of Christian faith, in word and in deed.",
    author: "Pope Benedict XVI"
  },
  {
    text: "Proclaim the Gospel: this is the essential mission of the Church.",
    author: "Pope Francis, Evangelii Gaudium"
  },
  {
    text: "The fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faithfulness, gentleness, self-control.",
    author: "Galatians 5:22–23"
  },
  {
    text: "You are the light of the world. A city set on a hill cannot be hidden.",
    author: "Matthew 5:14"
  },
  {
    text: "Always be prepared to make a defense to anyone who asks you for a reason for the hope that is in you.",
    author: "1 Peter 3:15"
  },
  {
    text: "The missionary task is not to bring about revolution in the world but to transfigure it, drawing power from Jesus Christ.",
    author: "Pope St. John Paul II, Redemptoris Missio"
  },
  {
    text: "Evangelization is the essential mission of the Church. It is not just one mission among others.",
    author: "Pope Francis, Evangelii Gaudium"
  },
  {
    text: "The Church is missionary by her very nature, for Christ's mandate is not something contingent or optional.",
    author: "Vatican II, Ad Gentes"
  },
  {
    text: "How beautiful are the feet of those who preach the good news!",
    author: "Romans 10:15"
  },
  {
    text: "The Church is sent by Christ to bring to all the glad tidings of salvation.",
    author: "Catechism of the Catholic Church, 851"
  },
  {
    text: "We cannot keep to ourselves the words of eternal life given to us for our salvation.",
    author: "Pope Francis, Evangelii Gaudium"
  },
  {
    text: "The witness of a Christian life is the first and irreplaceable form of mission.",
    author: "Pope Benedict XVI"
  },
  {
    text: "Let your light shine before others, so that they may see your good works and give glory to your Father who is in heaven.",
    author: "Matthew 5:16"
  },
  {
    text: "The Gospel is not merely a communication of things that can be known — it is one that makes things happen and is life-changing.",
    author: "Pope Benedict XVI"
  },
  {
    text: "The Church's mission is to bring the light of Christ to every corner of the earth.",
    author: "Pope St. John Paul II"
  },
  {
    text: "Faith is strengthened when it is given to others.",
    author: "Pope Francis, Evangelii Gaudium"
  },
  {
    text: "The lay faithful are called to live their baptismal commitment to the full, bringing the Gospel to every environment.",
    author: "Pope St. John Paul II, Christifideles Laici"
  },
  {
    text: "Go into all the world and proclaim the gospel to the whole creation.",
    author: "Mark 16:15"
  },
  {
    text: "The Church evangelizes when she seeks to convert, solely through the divine power of the message she proclaims.",
    author: "Pope Paul VI, Evangelii Nuntiandi"
  },
  {
    text: "Young people need to be accompanied in discovering the joy of a personal encounter with Jesus Christ.",
    author: "Pope Francis"
  },
  {
    text: "The missionary is convinced, through faith, of the saving power of the Gospel.",
    author: "Pope St. John Paul II, Redemptoris Missio"
  },
  {
    text: "No one is excluded from the joy brought by the Lord.",
    author: "Pope Francis, Evangelii Gaudium"
  },
  {
    text: "The love of Christ impels us to bring the Good News to all.",
    author: "2 Corinthians 5:14"
  }
]

export const pickRandomQuote = ( ): EvangelisationQuote => {
  return EVANGELISATION_QUOTES [ Math.floor ( Math.random ( ) * EVANGELISATION_QUOTES.length ) ]!
}
