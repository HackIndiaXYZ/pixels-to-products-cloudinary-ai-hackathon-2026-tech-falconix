let store = [];

class Media {
  static async create(data) {
    const doc = { ...data, createdAt: new Date(), updatedAt: new Date() };
    store.push(doc);
    return doc;
  }
  static async findOne(query) {
    return store.find(m => m.publicId === query.publicId) || null;
  }
  static find(query = {}) {
    let results = store;
    if (query.userId) results = results.filter(m => m.userId === query.userId);
    
    return {
      sort: () => ({
        skip: (s) => ({
          limit: (l) => results.sort((a, b) => b.createdAt - a.createdAt).slice(s, s + l)
        })
      })
    };
  }
  static async deleteOne(query) {
    store = store.filter(m => m.publicId !== query.publicId);
    return { deletedCount: 1 };
  }
  static async findOneAndUpdate(query, update, options = {}) {
    let doc = store.find(m => m.publicId === query.publicId);
    if (doc) {
      Object.assign(doc, update, { updatedAt: new Date() });
    } else if (options.upsert) {
      doc = { ...query, ...update, createdAt: new Date(), updatedAt: new Date() };
      store.push(doc);
    }
    return doc;
  }
}

module.exports = Media;
