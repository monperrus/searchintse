class Paper(dict):
    def __init__(self, match):
        super().__init__()
        
        self.id = match["id"]
        self.score = round(match["score"], 2)
        
        metadata = match["metadata"]
        self.title = metadata["title"] if "title" in metadata else "notitle"
        self.authors = metadata["authors"]  if "authors" in metadata else "noauthors"
        self.abstract = metadata["abstract"]  if "abstract" in metadata else "noabstract"
        self.year = metadata["year"]  if "year" in metadata else "noyear"
        self.month = metadata["month"]  if "month" in metadata else "nomonth"
        
        self.authors_parsed = self.authors
        if type(self.authors) == str:
            self.authors_parsed = [author.strip() for author in self.authors.split(",")]
