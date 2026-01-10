-- Migration: Add image posts feature with likes, comments, and shares
-- Description: Facebook-style posts for generated images and other content

-- ====================
-- POSTS TABLE
-- ====================
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    
    -- Content
    title TEXT,
    description TEXT,
    image_url TEXT NOT NULL,
    
    -- Post type
    post_type VARCHAR(50) DEFAULT 'image', -- 'image', 'ai_generated', 'update', etc.
    
    -- Metadata for AI-generated images
    ai_metadata JSONB DEFAULT '{}'::jsonb, -- Store prompt, model, etc.
    
    -- Privacy/visibility
    visibility VARCHAR(20) DEFAULT 'public', -- 'public', 'followers', 'private'
    
    -- Counters (denormalized for performance)
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT check_visibility CHECK (visibility IN ('public', 'followers', 'private'))
);

CREATE INDEX idx_posts_owner ON posts(owner_user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_visibility ON posts(visibility);
CREATE INDEX idx_posts_type ON posts(post_type);


-- ====================
-- LIKES TABLE
-- ====================
CREATE TABLE IF NOT EXISTS post_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint: one like per user per post
    UNIQUE(post_id, user_id)
);

CREATE INDEX idx_post_likes_post ON post_likes(post_id);
CREATE INDEX idx_post_likes_user ON post_likes(user_id);
CREATE INDEX idx_post_likes_created_at ON post_likes(created_at DESC);


-- ====================
-- COMMENTS TABLE
-- ====================
CREATE TABLE IF NOT EXISTS post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    
    -- Comment content
    content TEXT NOT NULL,
    
    -- Reply system
    parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
    
    -- Counters
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT check_content_length CHECK (char_length(content) <= 5000)
);

CREATE INDEX idx_post_comments_post ON post_comments(post_id);
CREATE INDEX idx_post_comments_user ON post_comments(user_id);
CREATE INDEX idx_post_comments_parent ON post_comments(parent_comment_id);
CREATE INDEX idx_post_comments_created_at ON post_comments(created_at DESC);


-- ====================
-- COMMENT LIKES TABLE
-- ====================
CREATE TABLE IF NOT EXISTS comment_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint: one like per user per comment
    UNIQUE(comment_id, user_id)
);

CREATE INDEX idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX idx_comment_likes_user ON comment_likes(user_id);


-- ====================
-- SHARES TABLE
-- ====================
CREATE TABLE IF NOT EXISTS post_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    
    -- Share type
    share_type VARCHAR(50) DEFAULT 'repost', -- 'repost', 'quote', 'external'
    
    -- Optional comment when sharing
    comment TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_post_shares_post ON post_shares(post_id);
CREATE INDEX idx_post_shares_user ON post_shares(user_id);
CREATE INDEX idx_post_shares_created_at ON post_shares(created_at DESC);


-- ====================
-- TRIGGERS FOR COUNTERS
-- ====================

-- Trigger to update post like_count
CREATE OR REPLACE FUNCTION update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_likes_count_trigger
AFTER INSERT OR DELETE ON post_likes
FOR EACH ROW EXECUTE FUNCTION update_post_like_count();


-- Trigger to update post comment_count
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_comments_count_trigger
AFTER INSERT OR DELETE ON post_comments
FOR EACH ROW EXECUTE FUNCTION update_post_comment_count();


-- Trigger to update post share_count
CREATE OR REPLACE FUNCTION update_post_share_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET share_count = share_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET share_count = GREATEST(share_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_shares_count_trigger
AFTER INSERT OR DELETE ON post_shares
FOR EACH ROW EXECUTE FUNCTION update_post_share_count();


-- Trigger to update comment like_count
CREATE OR REPLACE FUNCTION update_comment_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE post_comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE post_comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.comment_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_likes_count_trigger
AFTER INSERT OR DELETE ON comment_likes
FOR EACH ROW EXECUTE FUNCTION update_comment_like_count();


-- Trigger to update comment reply_count
CREATE OR REPLACE FUNCTION update_comment_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_comment_id IS NOT NULL THEN
        UPDATE post_comments SET reply_count = reply_count + 1 WHERE id = NEW.parent_comment_id;
    ELSIF TG_OP = 'DELETE' AND OLD.parent_comment_id IS NOT NULL THEN
        UPDATE post_comments SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = OLD.parent_comment_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_replies_count_trigger
AFTER INSERT OR DELETE ON post_comments
FOR EACH ROW EXECUTE FUNCTION update_comment_reply_count();


-- ====================
-- RLS POLICIES (if using Supabase)
-- ====================

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_shares ENABLE ROW LEVEL SECURITY;

-- Posts: anyone can view public posts, only owner can create/update/delete
CREATE POLICY "Public posts are viewable by everyone" ON posts
    FOR SELECT USING (visibility = 'public');

CREATE POLICY "Users can view their own posts" ON posts
    FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert their own posts" ON posts
    FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update their own posts" ON posts
    FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete their own posts" ON posts
    FOR DELETE USING (auth.uid() = owner_user_id);


-- Likes: anyone can view, users can manage their own likes
CREATE POLICY "Post likes are viewable by everyone" ON post_likes
    FOR SELECT USING (true);

CREATE POLICY "Users can like posts" ON post_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts" ON post_likes
    FOR DELETE USING (auth.uid() = user_id);


-- Comments: similar to likes
CREATE POLICY "Post comments are viewable by everyone" ON post_comments
    FOR SELECT USING (true);

CREATE POLICY "Users can comment on posts" ON post_comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON post_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON post_comments
    FOR DELETE USING (auth.uid() = user_id);


-- Comment likes
CREATE POLICY "Comment likes are viewable by everyone" ON comment_likes
    FOR SELECT USING (true);

CREATE POLICY "Users can like comments" ON comment_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike comments" ON comment_likes
    FOR DELETE USING (auth.uid() = user_id);


-- Shares
CREATE POLICY "Post shares are viewable by everyone" ON post_shares
    FOR SELECT USING (true);

CREATE POLICY "Users can share posts" ON post_shares
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shares" ON post_shares
    FOR DELETE USING (auth.uid() = user_id);


-- ====================
-- FUNCTIONS FOR COMMON QUERIES
-- ====================

-- Function to get post feed with user interactions
CREATE OR REPLACE FUNCTION get_post_feed(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    post_id UUID,
    owner_user_id UUID,
    owner_handle TEXT,
    owner_display_name TEXT,
    owner_avatar_url TEXT,
    title TEXT,
    description TEXT,
    image_url TEXT,
    post_type VARCHAR,
    ai_metadata JSONB,
    visibility VARCHAR,
    like_count INTEGER,
    comment_count INTEGER,
    share_count INTEGER,
    user_has_liked BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.owner_user_id,
        pr.handle::TEXT,
        pr.display_name::TEXT,
        pr.avatar_url::TEXT,
        p.title::TEXT,
        p.description::TEXT,
        p.image_url::TEXT,
        p.post_type,
        p.ai_metadata,
        p.visibility,
        p.like_count,
        p.comment_count,
        p.share_count,
        EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = p_user_id) as user_has_liked,
        p.created_at,
        p.updated_at
    FROM posts p
    JOIN profiles pr ON p.owner_user_id = pr.user_id
    WHERE p.visibility = 'public'
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;


-- ====================
-- SAMPLE DATA (optional)
-- ====================
-- This would be used by your generate_elton_image.py script
-- Example:
-- INSERT INTO posts (owner_user_id, title, description, image_url, post_type, ai_metadata)
-- VALUES (
--     '...user_id...',
--     'Elton John x Stranger Things',
--     'AI-generated image of Elton John performing in the Upside Down!',
--     'https://...image_url...',
--     'ai_generated',
--     '{"model": "dall-e-3", "prompt": "...", "style": "vivid"}'::jsonb
-- );








